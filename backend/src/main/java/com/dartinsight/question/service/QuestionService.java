package com.dartinsight.question.service;

import com.dartinsight.aiserver.client.AiServerClient;
import com.dartinsight.aiserver.client.AiServerException;
import com.dartinsight.aiserver.client.AiServerPaths;
import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.domain.FinancialChange;
import com.dartinsight.analysis.service.AnalysisResultService;
import com.dartinsight.analysis.service.AnalysisResultService.CompletedResult;
import com.dartinsight.analysis.service.TextEvidenceService;
import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.common.trace.TraceContext;
import com.dartinsight.document.domain.DocumentBlock;
import com.dartinsight.document.domain.ReportDocument;
import com.dartinsight.document.service.DocumentService;
import com.dartinsight.question.domain.FeedbackReason;
import com.dartinsight.question.domain.QuestionFact;
import com.dartinsight.question.domain.QuestionFeedback;
import com.dartinsight.question.domain.QuestionRecord;
import com.dartinsight.question.domain.QuestionSource;
import com.dartinsight.question.domain.QuestionStatus;
import com.dartinsight.question.domain.QuestionUsage;
import com.dartinsight.question.dto.AnswerAiRequest;
import com.dartinsight.question.dto.AnswerAiResponse;
import com.dartinsight.question.dto.QuestionFeedbackRequest;
import com.dartinsight.question.dto.QuestionFeedbackResponse;
import com.dartinsight.question.dto.QuestionListResponse;
import com.dartinsight.question.dto.QuestionResponse;
import com.dartinsight.question.dto.QuestionResponse.Citation;
import com.dartinsight.question.repository.QuestionStore;
import com.dartinsight.report.service.ReportService;
import com.dartinsight.report.service.ReportService.ReportDetail;
import com.dartinsight.summary.domain.LlmCallRow;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
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
 * 근거로 답하는 질문(3.10, ADR-0019). backend가 두 보고서 문단에서 후보를 찾고(QuestionRetriever), 질문에 나온 계정의
 * 사실 문장을 코드로 만든 뒤(QuestionFacts) AI 서버에 묻는다. 후보도 사실도 없으면 AI 서버를 부르지 않는다.
 * AI 서버 호출은 트랜잭션 밖에서 하고, 결과와 LLM 호출 기록만 한 트랜잭션으로 저장한다(LY-2).
 */
@Service
@RequiredArgsConstructor
public class QuestionService {

    static final int MIN_LENGTH = 2;
    static final int MAX_LENGTH = 200;
    static final int HISTORY_SIZE = 20;
    static final int QUOTE_CHARS = 160;
    static final int MAX_ANSWER_CHARS = 1000;
    static final String TASK = "answer";
    private static final String NOT_ANSWERED = "답한 질문만 평가할 수 있어요.";
    private static final String BAD_EVIDENCE = "답의 근거 표시가 보낸 원문 위치·사실이 아니라 쓰지 않았어요.";

    private static final Logger log = LoggerFactory.getLogger(QuestionService.class);

    private final AnalysisResultService resultService;
    private final ReportService reportService;
    private final DocumentService documentService;
    private final AiServerClient aiServerClient;
    private final QuestionStore questionStore;
    private final TransactionTemplate transactionTemplate;
    private final Clock clock;

    /**
     * 질문에 답한다. 완료된 분석에만 묻는다(아니면 409).
     *
     * @throws AiServerException AI 서버·LLM을 쓸 수 없음(503 AI_SERVER_UNAVAILABLE)
     */
    public QuestionResponse ask(Long analysisId, String rawQuestion) {
        String question = validate(rawQuestion);
        CompletedResult result = resultService.completedResult(analysisId);
        Analysis analysis = result.analysis();
        ReportDetail current = reportService.get(analysis.getCurrentRceptNo());
        ReportDetail previous = reportService.get(analysis.getPreviousRceptNo());
        Map<String, String> reportNames = Map.of(current.report().getRceptNo(), current.report().getReportName(),
                previous.report().getRceptNo(), previous.report().getReportName());

        Documents documents = new Documents();
        DocumentView cur = documents.of(analysis.getCurrentRceptNo());
        DocumentView prev = documents.of(analysis.getPreviousRceptNo());
        List<QuestionSource> sources = QuestionRetriever.sources(QuestionRetriever.terms(question), blocks(cur),
                cur.paths(), blocks(prev), prev.paths());
        List<QuestionFact> facts = QuestionFacts.match(question, result.changes());
        LocalDateTime createdAt = now();
        String traceId = TraceContext.currentTraceId();

        if (sources.isEmpty() && facts.isEmpty()) {
            QuestionRecord row = new QuestionRecord(null, analysisId, question, QuestionStatus.NOT_FOUND, null,
                    List.of(), List.of(), null, List.of(), null, null, null, traceId, createdAt, null);
            return QuestionResponse.of(save(row, List.of()), List.of(), List.of());
        }

        AnswerAiResponse response = aiServerClient.postJson(AiServerPaths.ANSWERS, new AnswerAiRequest(
                current.company().getCorpName(), previous.report().getReportName(), current.report().getReportName(),
                question, facts.stream().map(f -> new AnswerAiRequest.Fact(f.ref(), f.sentence())).toList(),
                sources.stream().map(s -> new AnswerAiRequest.Source(s.evidenceId(), s.side(), s.sectionPath(),
                        s.text())).toList()), AnswerAiResponse.class);
        if (response == null || response.status() == null) {
            throw new AiServerException(null, "AI 서버 답 응답이 비어 있어요.", null);
        }
        List<LlmCallRow> calls = response.calls() == null ? List.of()
                : response.calls().stream().map(c -> call(c, traceId)).toList();

        Map<String, QuestionSource> byEvidence = sources.stream()
                .collect(Collectors.toMap(QuestionSource::evidenceId, Function.identity(), (a, b) -> a));
        Map<String, QuestionFact> byRef = facts.stream()
                .collect(Collectors.toMap(QuestionFact::ref, Function.identity(), (a, b) -> a));
        QuestionRecord row = interpret(analysisId, question, response, byEvidence.keySet(), byRef, traceId,
                createdAt);
        QuestionRecord saved = save(row, calls);

        List<Citation> citations = new ArrayList<>();
        for (String evidenceId : saved.evidenceIds()) {
            citations.add(citation(citations.size() + 1, byEvidence.get(evidenceId), reportNames));
        }
        List<QuestionFact> cited = AnswerMarkers.factRefs(saved.answer()).stream().map(byRef::get).toList();
        return QuestionResponse.of(saved, citations, cited);
    }

    /** 질문한 시각이 [from, to)인 질문의 상태별 수와 평가 수(AI 사용 현황). 모든 분석의 질문을 센다 */
    public QuestionUsage usage(LocalDateTime from, LocalDateTime to) {
        return questionStore.usage(from, to);
    }

    /** 이 분석에서 한 질문, 최신 순으로 최대 20개. 없는 분석이면 404 */
    public QuestionListResponse history(Long analysisId) {
        Analysis analysis = resultService.get(analysisId);
        List<QuestionRecord> rows = questionStore.latest(analysisId, HISTORY_SIZE);
        if (rows.isEmpty()) {
            return new QuestionListResponse(List.of());
        }
        Map<String, String> reportNames = new HashMap<>();
        for (String rceptNo : List.of(analysis.getCurrentRceptNo(), analysis.getPreviousRceptNo())) {
            reportNames.put(rceptNo, reportService.report(rceptNo).getReportName());
        }
        Map<Long, FinancialChange> changes = rows.stream().anyMatch(r -> !r.factChangeIds().isEmpty())
                ? resultService.completedResult(analysisId).changes().stream()
                        .collect(Collectors.toMap(FinancialChange::getId, Function.identity()))
                : Map.of();
        Documents documents = new Documents();
        List<QuestionResponse> items = new ArrayList<>();
        for (QuestionRecord row : rows) {
            List<Citation> citations = new ArrayList<>();
            for (String evidenceId : row.evidenceIds()) {
                citations.add(citation(citations.size() + 1, documents.source(analysis, evidenceId), reportNames));
            }
            List<String> refs = AnswerMarkers.factRefs(row.answer());
            List<QuestionFact> facts = new ArrayList<>();
            for (int i = 0; i < refs.size() && i < row.factChangeIds().size(); i++) {
                FinancialChange change = changes.get(row.factChangeIds().get(i));
                if (change != null && QuestionFacts.hasFact(change)) {
                    facts.add(QuestionFacts.fact(refs.get(i), change));
                }
            }
            items.add(QuestionResponse.of(row, citations, facts));
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
            if (row.status() != QuestionStatus.ANSWERED) {
                throw new ApiException(ErrorCode.COMMON_INVALID_INPUT, NOT_ANSWERED);
            }
            questionStore.updateFeedback(questionId, feedback);
        });
        return QuestionFeedbackResponse.of(questionId, feedback);
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

    private static String validate(String rawQuestion) {
        String question = rawQuestion == null ? "" : rawQuestion.strip();
        if (question.isEmpty()) {
            throw ApiException.invalidInput("question", "질문을 입력해 주세요.");
        }
        if (question.length() < MIN_LENGTH || question.length() > MAX_LENGTH) {
            throw ApiException.invalidInput("question", MIN_LENGTH + "~" + MAX_LENGTH + "자로 입력해 주세요.");
        }
        return question;
    }

    /** AI 서버의 답을 저장할 기록으로 바꾼다. 답의 근거 표시는 여기서 다시 확인한다 */
    private QuestionRecord interpret(Long analysisId, String question, AnswerAiResponse response,
            Set<String> evidenceIds, Map<String, QuestionFact> facts, String traceId, LocalDateTime createdAt) {
        LocalDateTime generatedAt = time(response.generatedAt());
        List<String> blocked = response.blockedRules() == null ? List.of() : response.blockedRules();
        QuestionStatus status;
        try {
            status = QuestionStatus.valueOf(response.status());
        } catch (IllegalArgumentException e) {
            log.warn("AI 서버 답 상태를 알 수 없어 검토 필요로 둡니다: {}", response.status());
            return review(analysisId, question, "AI 서버가 알 수 없는 상태로 답했어요.", blocked, response, generatedAt,
                    traceId, createdAt);
        }
        if (status == QuestionStatus.REVIEW_NEEDED) {
            return review(analysisId, question, response.reviewReason(), blocked, response, generatedAt, traceId,
                    createdAt);
        }
        if (status != QuestionStatus.ANSWERED) {
            return new QuestionRecord(null, analysisId, question, status, null, List.of(), List.of(), null, blocked,
                    response.model(), response.promptVersion(), generatedAt, traceId, createdAt, null);
        }
        AnswerMarkers.Converted converted = AnswerMarkers.convert(response.answer(), evidenceIds, facts.keySet());
        if (!converted.valid() || converted.answer().length() > MAX_ANSWER_CHARS) {
            log.warn("AI 서버 답의 근거 표시를 확인하지 못해 검토 필요로 둡니다");
            return review(analysisId, question, BAD_EVIDENCE, blocked, response, generatedAt, traceId, createdAt);
        }
        List<Long> changeIds = converted.factRefs().stream().map(ref -> facts.get(ref).changeId()).toList();
        return new QuestionRecord(null, analysisId, question, QuestionStatus.ANSWERED, converted.answer(),
                converted.evidenceIds(), changeIds, null, List.of(), response.model(), response.promptVersion(),
                generatedAt, traceId, createdAt, null);
    }

    private static QuestionRecord review(Long analysisId, String question, String reason, List<String> blocked,
            AnswerAiResponse response, LocalDateTime generatedAt, String traceId, LocalDateTime createdAt) {
        return new QuestionRecord(null, analysisId, question, QuestionStatus.REVIEW_NEEDED, null, List.of(),
                List.of(), reason == null ? "근거를 확인하지 못했어요." : reason, blocked, response.model(),
                response.promptVersion(), generatedAt, traceId, createdAt, null);
    }

    private QuestionRecord save(QuestionRecord row, List<LlmCallRow> calls) {
        Long id = transactionTemplate.execute(status -> questionStore.save(row, calls));
        return row.withId(id);
    }

    private static Citation citation(int no, QuestionSource source, Map<String, String> reportNames) {
        String text = source.text();
        String quote = text == null ? null : text.length() <= QUOTE_CHARS ? text : text.substring(0, QUOTE_CHARS);
        return new Citation(no, source.evidenceId(), source.side(), source.rceptNo(),
                source.rceptNo() == null ? null : reportNames.get(source.rceptNo()), source.sectionNo(),
                source.blockNo(), source.sectionPath(), quote);
    }

    private static LlmCallRow call(AnswerAiResponse.Call call, String traceId) {
        return new LlmCallRow(call.task() == null ? TASK : call.task(), call.provider(), call.model(),
                call.promptVersion(), time(call.calledAt()), call.traceId() == null ? traceId : call.traceId(),
                call.inputTokens(), call.outputTokens(), call.latencyMs() == null ? 0 : call.latencyMs(),
                call.attempt() == null ? 1 : call.attempt(), call.outcome(), call.error());
    }

    private static LocalDateTime time(String value) {
        try {
            return value == null ? null : LocalDateTime.parse(value);
        } catch (DateTimeParseException e) {
            return null;
        }
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
            int mark = evidenceId.indexOf("#B");
            if (mark < 0) {
                return new QuestionSource(evidenceId, null, null, null, null, null, null);
            }
            String rceptNo = evidenceId.substring(0, mark);
            String side = rceptNo.equals(analysis.getCurrentRceptNo()) ? QuestionSource.CURRENT
                    : rceptNo.equals(analysis.getPreviousRceptNo()) ? QuestionSource.PREVIOUS : null;
            Integer blockNo;
            try {
                blockNo = Integer.valueOf(evidenceId.substring(mark + 2));
            } catch (NumberFormatException e) {
                return new QuestionSource(evidenceId, side, rceptNo, null, null, null, null);
            }
            DocumentView view = of(rceptNo);
            Optional<DocumentBlock> block = view.document() == null ? Optional.empty()
                    : documentService.block(view.document(), blockNo);
            return block.map(b -> new QuestionSource(evidenceId, side, rceptNo, b.sectionNo(), blockNo,
                            view.paths().get(b.sectionNo()), b.text()))
                    .orElseGet(() -> new QuestionSource(evidenceId, side, rceptNo, null, blockNo, null, null));
        }
    }

    private List<DocumentBlock> blocks(DocumentView view) {
        return view.document() == null ? List.of() : documentService.blocks(view.document());
    }

    /** 쓸 수 있는 원문(없으면 document가 null)과 섹션 번호 → 섹션 경로 */
    private record DocumentView(ReportDocument document, Map<Integer, String> paths) {
    }
}
