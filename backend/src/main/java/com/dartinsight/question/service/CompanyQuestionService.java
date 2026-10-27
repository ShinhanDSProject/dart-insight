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
import com.dartinsight.question.domain.CompanyQuestionRecord;
import com.dartinsight.document.domain.EvidenceRef;
import com.dartinsight.question.domain.QuestionRetriever;
import com.dartinsight.question.domain.QuestionSource;
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
import lombok.RequiredArgsConstructor;
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

        AnswerAiResponse response = AnswerResults.requireStatus(aiServerClient.postJson(AiServerPaths.ANSWERS,
                new AnswerAiRequest(list.company().getCorpName(), null, report.getReportName(), question, List.of(),
                        AnswerResults.requestSources(sources)), AnswerAiResponse.class));
        List<LlmCallRow> calls = AnswerResults.calls(response, traceId);
        Map<String, QuestionSource> byEvidence = AnswerResults.byEvidence(sources);
        AnswerResults.Verdict verdict = AnswerResults.verdict(response, byEvidence.keySet(), Set.of());
        CompanyQuestionRecord row = record(report.getRceptNo(), question, verdict, traceId, createdAt);
        Long id = transactionTemplate.execute(status -> store.save(row, calls));
        CompanyQuestionRecord saved = row.withId(id);

        return CompanyQuestionResponse.of(saved, report, citations(saved.evidenceIds(), byEvidence::get));
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
            List<Citation> citations = citations(row.evidenceIds(),
                    id -> stored(document, paths, report.getRceptNo(), id));
            items.add(CompanyQuestionResponse.of(row, report, citations));
        }
        return new CompanyQuestionListResponse(CompanyQuestionResponse.ReportRef.from(report), items);
    }

    private List<QuestionSource> sources(ReportDocument document, String question) {
        return QuestionRetriever.sources(QuestionRetriever.terms(question), documentService.blocks(document),
                TextEvidenceService.paths(documentService.sections(document)), List.of(), Map.of());
    }

    /** 판정한 답을 저장할 기록으로 */
    private static CompanyQuestionRecord record(String rceptNo, String question, AnswerResults.Verdict verdict,
            String traceId, LocalDateTime createdAt) {
        return new CompanyQuestionRecord(null, rceptNo, question, verdict.status(), verdict.answer(),
                verdict.evidenceIds(), verdict.reviewReason(), verdict.blockedRules(), verdict.model(),
                verdict.promptVersion(), verdict.generatedAt(), traceId, createdAt);
    }

    /** 저장된 근거 ID를 원문 위치로 다시 푼다. 블록을 찾지 못하면 위치 없이 */
    private QuestionSource stored(Optional<ReportDocument> document, Map<Integer, String> paths, String rceptNo,
            String evidenceId) {
        Integer no = EvidenceRef.parse(evidenceId).blockNo();
        Optional<DocumentBlock> block = no == null || document.isEmpty() ? Optional.empty()
                : documentService.block(document.get(), no);
        return block.map(b -> new QuestionSource(evidenceId, QuestionSource.CURRENT, rceptNo, b.sectionNo(), no,
                        paths.get(b.sectionNo()), b.text()))
                .orElseGet(() -> QuestionSource.unresolved(evidenceId, QuestionSource.CURRENT, rceptNo, no));
    }

    /** 인용 번호 순서의 근거 ID를 1부터 번호를 붙인 인용으로 */
    private static List<Citation> citations(List<String> evidenceIds, Function<String, QuestionSource> source) {
        List<Citation> citations = new ArrayList<>();
        for (String evidenceId : evidenceIds) {
            citations.add(citation(citations.size() + 1, source.apply(evidenceId)));
        }
        return citations;
    }

    private static Citation citation(int no, QuestionSource source) {
        return new Citation(no, source.evidenceId(), source.rceptNo(), source.sectionNo(), source.blockNo(),
                source.sectionPath(), AnswerResults.quote(source.text()));
    }

    private LocalDateTime now() {
        return LocalDateTime.now(clock).truncatedTo(ChronoUnit.MICROS);
    }
}
