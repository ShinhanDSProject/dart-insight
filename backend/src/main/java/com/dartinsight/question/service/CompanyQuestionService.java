package com.dartinsight.question.service;

import com.dartinsight.aiserver.client.AiServerClient;
import com.dartinsight.aiserver.client.AiServerException;
import com.dartinsight.aiserver.client.AiServerPaths;
import com.dartinsight.analysis.service.TextEvidenceService;
import com.dartinsight.briefing.service.BriefingService;
import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.common.trace.TraceContext;
import com.dartinsight.document.domain.DocumentBlock;
import com.dartinsight.document.domain.ReportDocument;
import com.dartinsight.document.service.DocumentService;
import com.dartinsight.question.domain.AnswerMarkers;
import com.dartinsight.question.domain.CompanyQuestionRecord;
import com.dartinsight.question.domain.QuestionRetriever;
import com.dartinsight.question.domain.QuestionSource;
import com.dartinsight.question.domain.QuestionStatus;
import com.dartinsight.question.dto.AnswerAiRequest;
import com.dartinsight.question.dto.AnswerAiResponse;
import com.dartinsight.question.dto.CompanyQuestionListResponse;
import com.dartinsight.question.dto.CompanyQuestionResponse;
import com.dartinsight.question.dto.CompanyQuestionResponse.Citation;
import com.dartinsight.question.repository.CompanyQuestionStore;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.service.ReportService;
import com.dartinsight.report.service.ReportService.ReportList;
import com.dartinsight.summary.domain.LlmCallRow;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 기업 개요 탭의 '사업보고서에 근거해 묻기'(1.2, FS-53, ADR-0029). 동기 호출이다.
 * <ol>
 *   <li>대상 보고서는 브리핑과 같다({@link BriefingService#sourceReport}): 최신 사업보고서, 없으면 최신 정기보고서</li>
 *   <li>원문을 준비하고({@link DocumentService#ensureStructured}) 그 보고서 문단에서 낱말로 후보를 찾는다
 *       ({@link QuestionRetriever}, 이전 보고서 쪽은 비움). 사실 문장은 없다</li>
 *   <li>후보가 없어도 AI 서버에 묻는다. 투자 판단 질문이면 OUT_OF_SCOPE, 아니면 NOT_FOUND로 LLM 없이 끝난다</li>
 * </ol>
 * AI 서버 호출은 트랜잭션 밖에서 하고, 결과와 LLM 호출 기록만 한 트랜잭션으로 저장한다(LY-2).
 */
@Service
@RequiredArgsConstructor
public class CompanyQuestionService {

    private static final Logger log = LoggerFactory.getLogger(CompanyQuestionService.class);

    private final ReportService reportService;
    private final DocumentService documentService;
    private final AiServerClient aiServerClient;
    private final CompanyQuestionStore store;
    private final TransactionTemplate transactionTemplate;
    private final Clock clock;

    /**
     * 질문에 답한다. 없는 기업은 404 COMPANY_NOT_FOUND, 정기보고서가 없으면 404 REPORT_NOT_FOUND.
     *
     * @throws AiServerException AI 서버·LLM을 쓸 수 없음(503 AI_SERVER_UNAVAILABLE)
     */
    public CompanyQuestionResponse ask(String corpCode, String rawQuestion) {
        String question = AnswerResults.validate(rawQuestion);
        ReportList list = reportService.list(corpCode);
        Report report = BriefingService.sourceReport(list.reports())
                .orElseThrow(() -> new ApiException(ErrorCode.REPORT_NOT_FOUND, "이 기업의 정기보고서가 없어요."));
        ReportDocument document = documentService.ensureStructured(report);
        List<QuestionSource> sources = document.getStatus().usable() ? sources(document, question) : List.of();
        String traceId = TraceContext.currentTraceId();
        LocalDateTime createdAt = now();

        AnswerAiResponse response = aiServerClient.postJson(AiServerPaths.ANSWERS, new AnswerAiRequest(
                list.company().getCorpName(), null, report.getReportName(), question, List.of(),
                sources.stream().map(s -> new AnswerAiRequest.Source(s.evidenceId(), s.side(), s.sectionPath(),
                        s.text())).toList()), AnswerAiResponse.class);
        if (response == null || response.status() == null) {
            throw new AiServerException(null, "AI 서버 답 응답이 비어 있어요.", null);
        }
        List<LlmCallRow> calls = response.calls() == null ? List.of()
                : response.calls().stream().map(c -> AnswerResults.call(c, traceId)).toList();
        Map<String, QuestionSource> byEvidence = sources.stream()
                .collect(Collectors.toMap(QuestionSource::evidenceId, Function.identity(), (a, b) -> a));
        CompanyQuestionRecord row = interpret(report.getRceptNo(), question, response, byEvidence.keySet(), traceId,
                createdAt);
        Long id = transactionTemplate.execute(status -> store.save(row, calls));
        CompanyQuestionRecord saved = row.withId(id);

        List<Citation> citations = new ArrayList<>();
        for (String evidenceId : saved.evidenceIds()) {
            citations.add(citation(citations.size() + 1, byEvidence.get(evidenceId)));
        }
        return CompanyQuestionResponse.of(saved, report, citations);
    }

    /** 지금 대상 보고서에 한 질문, 최신 순으로 최대 20개. 정기보고서가 없으면 빈 목록. 없는 기업은 404 */
    public CompanyQuestionListResponse history(String corpCode) {
        Optional<Report> source = BriefingService.sourceReport(reportService.list(corpCode).reports());
        if (source.isEmpty()) {
            return new CompanyQuestionListResponse(null, List.of());
        }
        Report report = source.get();
        List<CompanyQuestionRecord> rows = store.latest(report.getRceptNo(), AnswerResults.HISTORY_SIZE);
        if (rows.isEmpty()) {
            return new CompanyQuestionListResponse(CompanyQuestionResponse.ReportRef.from(report), List.of());
        }
        Optional<ReportDocument> document = documentService.find(report.getRceptNo())
                .filter(d -> d.getStatus().usable());
        Map<Integer, String> paths = TextEvidenceService.paths(
                document.map(documentService::sections).orElse(List.of()));
        List<CompanyQuestionResponse> items = new ArrayList<>();
        for (CompanyQuestionRecord row : rows) {
            List<Citation> citations = new ArrayList<>();
            for (String evidenceId : row.evidenceIds()) {
                citations.add(citation(citations.size() + 1, stored(document, paths, report.getRceptNo(),
                        evidenceId)));
            }
            items.add(CompanyQuestionResponse.of(row, report, citations));
        }
        return new CompanyQuestionListResponse(CompanyQuestionResponse.ReportRef.from(report), items);
    }

    private List<QuestionSource> sources(ReportDocument document, String question) {
        return QuestionRetriever.sources(QuestionRetriever.terms(question), documentService.blocks(document),
                TextEvidenceService.paths(documentService.sections(document)), List.of(), Map.of());
    }

    /** AI 서버의 답을 저장할 기록으로 바꾼다. 답의 근거 표시는 여기서 다시 확인한다 */
    private static CompanyQuestionRecord interpret(String rceptNo, String question, AnswerAiResponse response,
            Set<String> evidenceIds, String traceId, LocalDateTime createdAt) {
        LocalDateTime generatedAt = AnswerResults.time(response.generatedAt());
        List<String> blocked = response.blockedRules() == null ? List.of() : response.blockedRules();
        QuestionStatus status;
        try {
            status = QuestionStatus.valueOf(response.status());
        } catch (IllegalArgumentException e) {
            log.warn("AI 서버 답 상태를 알 수 없어 검토 필요로 둡니다: {}", response.status());
            return review(rceptNo, question, AnswerResults.UNKNOWN_STATUS, blocked, response, generatedAt, traceId,
                    createdAt);
        }
        if (status == QuestionStatus.REVIEW_NEEDED) {
            return review(rceptNo, question, response.reviewReason(), blocked, response, generatedAt, traceId,
                    createdAt);
        }
        if (status != QuestionStatus.ANSWERED) {
            return new CompanyQuestionRecord(null, rceptNo, question, status, null, List.of(), null, blocked,
                    response.model(), response.promptVersion(), generatedAt, traceId, createdAt);
        }
        AnswerMarkers.Converted converted = AnswerMarkers.convert(response.answer(), evidenceIds, Set.of());
        if (!converted.valid() || converted.answer().length() > AnswerResults.MAX_ANSWER_CHARS) {
            log.warn("AI 서버 답의 근거 표시를 확인하지 못해 검토 필요로 둡니다");
            return review(rceptNo, question, AnswerResults.BAD_EVIDENCE, blocked, response, generatedAt, traceId,
                    createdAt);
        }
        return new CompanyQuestionRecord(null, rceptNo, question, QuestionStatus.ANSWERED, converted.answer(),
                converted.evidenceIds(), null, List.of(), response.model(), response.promptVersion(), generatedAt,
                traceId, createdAt);
    }

    private static CompanyQuestionRecord review(String rceptNo, String question, String reason,
            List<String> blocked, AnswerAiResponse response, LocalDateTime generatedAt, String traceId,
            LocalDateTime createdAt) {
        return new CompanyQuestionRecord(null, rceptNo, question, QuestionStatus.REVIEW_NEEDED, null, List.of(),
                reason == null ? AnswerResults.NOT_VERIFIED : reason, blocked, response.model(),
                response.promptVersion(), generatedAt, traceId, createdAt);
    }

    /** 저장된 근거 ID를 원문 위치로 다시 푼다. 블록을 찾지 못하면 위치 없이 */
    private QuestionSource stored(Optional<ReportDocument> document, Map<Integer, String> paths, String rceptNo,
            String evidenceId) {
        int mark = evidenceId.indexOf("#B");
        Integer blockNo = null;
        if (mark >= 0) {
            try {
                blockNo = Integer.valueOf(evidenceId.substring(mark + 2));
            } catch (NumberFormatException e) {
                blockNo = null;
            }
        }
        Integer no = blockNo;
        Optional<DocumentBlock> block = no == null || document.isEmpty() ? Optional.empty()
                : documentService.block(document.get(), no);
        return block.map(b -> new QuestionSource(evidenceId, QuestionSource.CURRENT, rceptNo, b.sectionNo(), no,
                        paths.get(b.sectionNo()), b.text()))
                .orElseGet(() -> new QuestionSource(evidenceId, QuestionSource.CURRENT, rceptNo, null, no, null,
                        null));
    }

    private static Citation citation(int no, QuestionSource source) {
        return new Citation(no, source.evidenceId(), source.rceptNo(), source.sectionNo(), source.blockNo(),
                source.sectionPath(), AnswerResults.quote(source.text()));
    }

    private LocalDateTime now() {
        return LocalDateTime.now(clock).truncatedTo(ChronoUnit.MICROS);
    }
}
