package com.dartinsight.question.service;

import com.dartinsight.aiserver.client.AiServerClient;
import com.dartinsight.aiserver.client.AiServerException;
import com.dartinsight.aiserver.client.AiServerPaths;
import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.domain.FinancialChange;
import com.dartinsight.analysis.service.AnalysisResultService;
import com.dartinsight.analysis.service.AnalysisResultService.CompletedResult;
import com.dartinsight.analysis.service.TextChangeQueryService;
import com.dartinsight.analysis.service.TextEvidenceService;
import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.common.trace.TraceContext;
import com.dartinsight.document.domain.DocumentBlock;
import com.dartinsight.document.domain.ReportDocument;
import com.dartinsight.document.service.DocumentService;
import com.dartinsight.question.domain.AnswerMarkers;
import com.dartinsight.question.domain.CitedSource;
import com.dartinsight.question.domain.EvidenceRef;
import com.dartinsight.question.domain.FeedbackReason;
import com.dartinsight.question.domain.QuestionFact;
import com.dartinsight.question.domain.QuestionFacts;
import com.dartinsight.question.domain.QuestionFeedback;
import com.dartinsight.question.domain.QuestionRecord;
import com.dartinsight.question.domain.QuestionRetriever;
import com.dartinsight.question.domain.QuestionSource;
import com.dartinsight.question.domain.QuestionStatus;
import com.dartinsight.question.domain.QuestionUsage;
import com.dartinsight.question.domain.SectionSources;
import com.dartinsight.question.dto.AnswerAiRequest;
import com.dartinsight.question.dto.AnswerAiResponse;
import com.dartinsight.question.dto.QuestionFeedbackRequest;
import com.dartinsight.question.dto.QuestionFeedbackResponse;
import com.dartinsight.question.dto.QuestionListResponse;
import com.dartinsight.question.dto.QuestionResponse;
import com.dartinsight.question.dto.QuestionResponse.Citation;
import com.dartinsight.question.repository.CompanyQuestionStore;
import com.dartinsight.question.repository.QuestionStore;
import com.dartinsight.report.service.ReportService;
import com.dartinsight.report.service.ReportService.ReportDetail;
import com.dartinsight.summary.domain.LlmCallRow;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 근거로 답하는 질문(3.10, ADR-0023). 질문에 섹션 이름이 나오고 그 섹션에 문장 변경이 있으면 그 변경 문단을
 * 후보로 삼고(SectionSources, #258), 아니면 두 보고서 문단에서 낱말로 후보를 찾는다(QuestionRetriever). 질문에 나온 계정의
 * 사실 문장을 코드로 만든 뒤(QuestionFacts) AI 서버에 묻는다. 후보도 사실도 없으면 AI 서버를 부르지 않는다.
 * AI 서버 호출은 트랜잭션 밖에서 하고, 결과와 LLM 호출 기록만 한 트랜잭션으로 저장한다(LY-2).
 */
@Service
@RequiredArgsConstructor
public class QuestionService {

    /** 섹션 범위에서 읽을 변경 수(우선순위 순). 후보는 이 중 앞 6개 문단만 쓴다 */
    static final int SECTION_CHANGES = 200;
    private static final String NOT_ANSWERED = "답한 질문만 평가할 수 있어요.";
    private static final String CITATION_NOT_FOUND = "답의 인용을 찾을 수 없습니다. 질문 기록을 다시 불러와 주세요.";

    private final AnalysisResultService resultService;
    private final TextChangeQueryService textChangeQueryService;
    private final ReportService reportService;
    private final DocumentService documentService;
    private final AiServerClient aiServerClient;
    private final QuestionStore questionStore;
    private final CompanyQuestionStore companyQuestionStore;
    private final TransactionTemplate transactionTemplate;
    private final Clock clock;

    /**
     * 질문에 답한다. 완료된 분석에만 묻는다(아니면 409).
     *
     * @throws AiServerException AI 서버·LLM을 쓸 수 없음(503 AI_SERVER_UNAVAILABLE)
     */
    public QuestionResponse ask(Long analysisId, String rawQuestion) {
        String question = AnswerResults.validate(rawQuestion);
        CompletedResult result = resultService.completedResult(analysisId);
        Analysis analysis = result.analysis();
        ReportDetail current = reportService.get(analysis.getCurrentRceptNo());
        ReportDetail previous = reportService.get(analysis.getPreviousRceptNo());
        Map<String, String> reportNames = reportNames(current, previous);

        List<QuestionSource> sources = sources(analysisId, analysis, question);
        List<QuestionFact> facts = QuestionFacts.match(question, result.changes());
        LocalDateTime createdAt = now();
        String traceId = TraceContext.currentTraceId();

        if (sources.isEmpty() && facts.isEmpty()) {
            QuestionRecord row = QuestionRecord.notFound(analysisId, question, traceId, createdAt);
            return QuestionResponse.of(save(row, List.of()), List.of(), List.of());
        }

        AnswerAiResponse response = AnswerResults.requireStatus(aiServerClient.postJson(AiServerPaths.ANSWERS,
                request(current, previous, question, facts, sources), AnswerAiResponse.class));
        List<LlmCallRow> calls = AnswerResults.calls(response, traceId);

        Map<String, QuestionSource> byEvidence = AnswerResults.byEvidence(sources);
        Map<String, QuestionFact> byRef = facts.stream()
                .collect(Collectors.toMap(QuestionFact::ref, Function.identity(), (a, b) -> a));
        AnswerResults.Verdict verdict = AnswerResults.verdict(response, byEvidence.keySet(), byRef.keySet());
        QuestionRecord saved = save(record(analysisId, question, verdict, byRef, traceId, createdAt), calls);

        List<Citation> citations = citations(saved.evidenceIds(), byEvidence::get, reportNames);
        List<QuestionFact> cited = AnswerMarkers.factRefs(saved.answer()).stream().map(byRef::get).toList();
        return QuestionResponse.of(saved, citations, cited);
    }

    /**
     * 질문한 시각이 [from, to)인 질문의 상태별 수와 평가 수(AI 사용 현황). 모든 분석의 질문과 기업 질문(ADR-0029)을
     * 함께 센다. 평가는 분석 질문에만 있다
     */
    public QuestionUsage usage(LocalDateTime from, LocalDateTime to) {
        QuestionUsage usage = questionStore.usage(from, to);
        Map<QuestionStatus, Long> byStatus = new EnumMap<>(usage.byStatus());
        companyQuestionStore.countByStatus(from, to).forEach((status, n) -> byStatus.merge(status, n, Long::sum));
        return new QuestionUsage(byStatus, usage.helpful(), usage.notHelpful(), usage.reasons());
    }

    /** 이 분석에서 한 질문, 최신 순으로 최대 20개. 없는 분석이면 404 */
    public QuestionListResponse history(Long analysisId) {
        Analysis analysis = resultService.get(analysisId);
        List<QuestionRecord> rows = questionStore.latest(analysisId, AnswerResults.HISTORY_SIZE);
        if (rows.isEmpty()) {
            return new QuestionListResponse(List.of());
        }
        Map<String, String> reportNames = reportNames(analysis);
        Map<Long, FinancialChange> changes = citedChanges(analysisId, rows);
        Documents documents = new Documents();
        List<QuestionResponse> items = new ArrayList<>();
        for (QuestionRecord row : rows) {
            List<Citation> citations = citations(row.evidenceIds(), id -> documents.source(analysis, id),
                    reportNames);
            items.add(QuestionResponse.of(row, citations, storedFacts(row, changes)));
        }
        return new QuestionListResponse(items);
    }

    /**
     * 답 평가를 저장한다(3.12, FS-9). 질문 하나에 평가 하나이고 다시 보내면 덮어쓴다.
     * 없는 분석은 404 ANALYSIS_NOT_FOUND, 이 분석의 질문이 아니면 404 ANALYSIS_QUESTION_NOT_FOUND,
     * 답한(ANSWERED) 질문이 아니면 400 COMMON_INVALID_INPUT이다.
     */
    public QuestionFeedbackResponse feedback(Long analysisId, Long questionId, QuestionFeedbackRequest request) {
        QuestionFeedback feedback = feedback(request, now());
        resultService.get(analysisId);
        transactionTemplate.executeWithoutResult(status -> {
            QuestionRecord row = questionStore.find(analysisId, questionId)
                    .orElseThrow(() -> new ApiException(ErrorCode.ANALYSIS_QUESTION_NOT_FOUND));
            if (!row.answered()) {
                throw new ApiException(ErrorCode.COMMON_INVALID_INPUT, NOT_ANSWERED);
            }
            questionStore.updateFeedback(questionId, feedback);
        });
        return QuestionFeedbackResponse.of(questionId, feedback);
    }

    /**
     * 저장된 답의 인용 하나를 원문 문단으로 다시 푼다(판단 노트에 담기, #432). 화면이 보낸 글은 쓰지 않는다.
     * 이 분석의 답한 질문이 아니거나, 그 번호의 인용이 없거나, 저장된 원문에서 문단을 찾지 못하면
     * 404 ANALYSIS_QUESTION_NOT_FOUND다. LLM을 부르지 않는다.
     */
    public CitedSource citedSource(Analysis analysis, long questionId, int citationNo) {
        QuestionRecord row = questionStore.find(analysis.getId(), questionId)
                .filter(QuestionRecord::answered)
                .orElseThrow(() -> new ApiException(ErrorCode.ANALYSIS_QUESTION_NOT_FOUND));
        if (citationNo < 1 || citationNo > row.evidenceIds().size()) {
            throw new ApiException(ErrorCode.ANALYSIS_QUESTION_NOT_FOUND, CITATION_NOT_FOUND);
        }
        QuestionSource source = new Documents().source(analysis, row.evidenceIds().get(citationNo - 1));
        if (!source.hasParagraph()) {
            throw new ApiException(ErrorCode.ANALYSIS_QUESTION_NOT_FOUND, CITATION_NOT_FOUND);
        }
        return new CitedSource(questionId, row.question(), source);
    }

    private static QuestionFeedback feedback(QuestionFeedbackRequest request, LocalDateTime at) {
        if (request == null || request.helpful() == null) {
            throw ApiException.invalidInput("helpful", "도움이 됐는지 true·false로 보내 주세요.");
        }
        if (request.reason() == null) {
            return new QuestionFeedback(request.helpful(), null, at);
        }
        if (request.helpful()) {
            throw ApiException.invalidInput("reason", "도움이 된 답에는 사유를 보내지 않아요.");
        }
        FeedbackReason reason = FeedbackReason.find(request.reason()).orElseThrow(() -> ApiException.invalidInput(
                "reason", "WRONG_SOURCE·NOT_ANSWERED·HARD_TO_READ·OTHER 중 하나여야 해요."));
        return new QuestionFeedback(false, reason, at);
    }

    /** 섹션 이름이 든 질문이면 그 섹션의 변경 문단, 아니거나 그 섹션에 쓸 변경이 없으면 낱말 검색 */
    private List<QuestionSource> sources(Long analysisId, Analysis analysis, String question) {
        Optional<String> scope = SectionSources.scope(question, textChangeQueryService.sectionPaths(analysisId));
        if (scope.isPresent()) {
            List<QuestionSource> sources = SectionSources.sources(
                    textChangeQueryService.changesInSection(analysisId, scope.get(), SECTION_CHANGES));
            if (!sources.isEmpty()) {
                return sources;
            }
        }
        Documents documents = new Documents();
        DocumentView cur = documents.of(analysis.getCurrentRceptNo());
        DocumentView prev = documents.of(analysis.getPreviousRceptNo());
        return QuestionRetriever.sources(QuestionRetriever.terms(question), blocks(cur), cur.paths(), blocks(prev),
                prev.paths());
    }

    private static AnswerAiRequest request(ReportDetail current, ReportDetail previous, String question,
            List<QuestionFact> facts, List<QuestionSource> sources) {
        return new AnswerAiRequest(current.company().getCorpName(), previous.report().getReportName(),
                current.report().getReportName(), question,
                facts.stream().map(f -> new AnswerAiRequest.Fact(f.ref(), f.sentence())).toList(),
                AnswerResults.requestSources(sources));
    }

    /** 판정한 답을 저장할 기록으로. 인용한 사실 ref는 그 사실의 변경 ID로 바꾼다 */
    private static QuestionRecord record(Long analysisId, String question, AnswerResults.Verdict verdict,
            Map<String, QuestionFact> facts, String traceId, LocalDateTime createdAt) {
        List<Long> changeIds = verdict.factRefs().stream().map(ref -> facts.get(ref).changeId()).toList();
        return new QuestionRecord(null, analysisId, question, verdict.status(), verdict.answer(),
                verdict.evidenceIds(), changeIds, verdict.reviewReason(), verdict.blockedRules(), verdict.model(),
                verdict.promptVersion(), verdict.generatedAt(), traceId, createdAt, null);
    }

    private QuestionRecord save(QuestionRecord row, List<LlmCallRow> calls) {
        Long id = transactionTemplate.execute(status -> questionStore.save(row, calls));
        return row.withId(id);
    }

    private static Map<String, String> reportNames(ReportDetail current, ReportDetail previous) {
        return Map.of(current.report().getRceptNo(), current.report().getReportName(),
                previous.report().getRceptNo(), previous.report().getReportName());
    }

    private Map<String, String> reportNames(Analysis analysis) {
        Map<String, String> reportNames = new HashMap<>();
        for (String rceptNo : List.of(analysis.getCurrentRceptNo(), analysis.getPreviousRceptNo())) {
            reportNames.put(rceptNo, reportService.report(rceptNo).getReportName());
        }
        return reportNames;
    }

    /** 사실을 인용한 질문이 있을 때만 분석의 재무 변경을 읽는다(변경 ID → 변경) */
    private Map<Long, FinancialChange> citedChanges(Long analysisId, List<QuestionRecord> rows) {
        if (rows.stream().allMatch(r -> r.factChangeIds().isEmpty())) {
            return Map.of();
        }
        return resultService.completedResult(analysisId).changes().stream()
                .collect(Collectors.toMap(FinancialChange::getId, Function.identity()));
    }

    /** 저장된 답의 사실 ref와 변경 ID를 순서대로 짝지어 사실 문장을 다시 만든다 */
    private static List<QuestionFact> storedFacts(QuestionRecord row, Map<Long, FinancialChange> changes) {
        List<String> refs = AnswerMarkers.factRefs(row.answer());
        List<QuestionFact> facts = new ArrayList<>();
        for (int i = 0; i < refs.size() && i < row.factChangeIds().size(); i++) {
            FinancialChange change = changes.get(row.factChangeIds().get(i));
            if (change != null && QuestionFacts.hasFact(change)) {
                facts.add(QuestionFacts.fact(refs.get(i), change));
            }
        }
        return facts;
    }

    /** 인용 번호 순서의 근거 ID를 1부터 번호를 붙인 인용으로 */
    private static List<Citation> citations(List<String> evidenceIds, Function<String, QuestionSource> source,
            Map<String, String> reportNames) {
        List<Citation> citations = new ArrayList<>();
        for (String evidenceId : evidenceIds) {
            citations.add(citation(citations.size() + 1, source.apply(evidenceId), reportNames));
        }
        return citations;
    }

    private static Citation citation(int no, QuestionSource source, Map<String, String> reportNames) {
        String quote = AnswerResults.quote(source.text());
        return new Citation(no, source.evidenceId(), source.side(), source.rceptNo(),
                source.rceptNo() == null ? null : reportNames.get(source.rceptNo()), source.sectionNo(),
                source.blockNo(), source.sectionPath(), quote);
    }

    private LocalDateTime now() {
        return LocalDateTime.now(clock).truncatedTo(ChronoUnit.MICROS);
    }

    /** 한 요청 안에서 같은 원문을 다시 읽지 않게 접수번호별로 둔다 */
    private final class Documents {

        private final Map<String, DocumentView> views = new HashMap<>();

        DocumentView of(String rceptNo) {
            return views.computeIfAbsent(rceptNo, r -> {
                Optional<ReportDocument> document = documentService.find(r).filter(d -> d.getStatus().usable());
                return new DocumentView(document.orElse(null),
                        TextEvidenceService.paths(document.map(documentService::sections).orElse(List.of())));
            });
        }

        /** 저장된 근거 ID를 원문 위치로 다시 푼다. 블록을 찾지 못하면 위치 없이 */
        QuestionSource source(Analysis analysis, String evidenceId) {
            EvidenceRef ref = EvidenceRef.parse(evidenceId);
            if (ref.rceptNo() == null) {
                return QuestionSource.unresolved(evidenceId, null, null, null);
            }
            String rceptNo = ref.rceptNo();
            String side = QuestionSource.sideOf(rceptNo, analysis.getCurrentRceptNo(), analysis.getPreviousRceptNo());
            Integer blockNo = ref.blockNo();
            if (blockNo == null) {
                return QuestionSource.unresolved(evidenceId, side, rceptNo, null);
            }
            DocumentView view = of(rceptNo);
            Optional<DocumentBlock> block = view.document() == null ? Optional.empty()
                    : documentService.block(view.document(), blockNo);
            return block.map(b -> new QuestionSource(evidenceId, side, rceptNo, b.sectionNo(), blockNo,
                            view.paths().get(b.sectionNo()), b.text()))
                    .orElseGet(() -> QuestionSource.unresolved(evidenceId, side, rceptNo, blockNo));
        }
    }

    private List<DocumentBlock> blocks(DocumentView view) {
        return view.document() == null ? List.of() : documentService.blocks(view.document());
    }

    /** 쓸 수 있는 원문(없으면 document가 null)과 섹션 번호 → 섹션 경로 */
    private record DocumentView(ReportDocument document, Map<Integer, String> paths) {
    }
}
