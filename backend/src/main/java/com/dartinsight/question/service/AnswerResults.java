package com.dartinsight.question.service;

import com.dartinsight.aiserver.client.AiServerException;
import com.dartinsight.common.error.ApiException;
import com.dartinsight.question.domain.AnswerMarkers;
import com.dartinsight.question.domain.QuestionSource;
import com.dartinsight.question.domain.QuestionStatus;
import com.dartinsight.question.dto.AnswerAiRequest;
import com.dartinsight.question.dto.AnswerAiResponse;
import com.dartinsight.summary.domain.LlmCallRow;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * 분석 질문(QuestionService)과 기업 질문(CompanyQuestionService)이 함께 쓰는 질문 검사·AI 서버 답 변환(ADR-0029).
 */
final class AnswerResults {

    static final int MIN_LENGTH = 2;
    static final int MAX_LENGTH = 200;
    static final int HISTORY_SIZE = 20;
    static final int QUOTE_CHARS = 160;
    static final int MAX_ANSWER_CHARS = 1000;
    /** ai-server app/answer/prompt.py TASK. 호출 기록에 task가 없을 때 쓴다 */
    static final String TASK = "answer";
    static final String BAD_EVIDENCE = "답의 근거 표시가 보낸 원문 위치·사실이 아니라 쓰지 않았어요.";
    static final String NOT_VERIFIED = "근거를 확인하지 못했어요.";
    static final String UNKNOWN_STATUS = "AI 서버가 알 수 없는 상태로 답했어요.";

    private static final Logger log = LoggerFactory.getLogger(AnswerResults.class);

    private AnswerResults() {
    }

    /** 앞뒤 공백을 뺀 2~200자 질문. 아니면 400 errors[question] */
    static String validate(String rawQuestion) {
        String question = rawQuestion == null ? "" : rawQuestion.strip();
        if (question.isEmpty()) {
            throw ApiException.invalidInput("question", "질문을 입력해 주세요.");
        }
        if (question.length() < MIN_LENGTH || question.length() > MAX_LENGTH) {
            throw ApiException.invalidInput("question", MIN_LENGTH + "~" + MAX_LENGTH + "자로 입력해 주세요.");
        }
        return question;
    }

    static String quote(String text) {
        return text == null ? null : text.length() <= QUOTE_CHARS ? text : text.substring(0, QUOTE_CHARS);
    }

    /** AI 서버에 보낼 후보 문단 */
    static List<AnswerAiRequest.Source> requestSources(List<QuestionSource> sources) {
        return sources.stream()
                .map(s -> new AnswerAiRequest.Source(s.evidenceId(), s.side(), s.sectionPath(), s.text())).toList();
    }

    /** 근거 ID → 후보 문단(같은 ID면 앞의 것) */
    static Map<String, QuestionSource> byEvidence(List<QuestionSource> sources) {
        return sources.stream()
                .collect(Collectors.toMap(QuestionSource::evidenceId, Function.identity(), (a, b) -> a));
    }

    /** 상태가 없는 답 응답은 AI 서버를 쓸 수 없는 것으로 본다 */
    static AnswerAiResponse requireStatus(AnswerAiResponse response) {
        if (response == null || response.status() == null) {
            throw new AiServerException(null, "AI 서버 답 응답이 비어 있어요.", null);
        }
        return response;
    }

    static List<LlmCallRow> calls(AnswerAiResponse response, String traceId) {
        return response.calls() == null ? List.of() : response.calls().stream().map(c -> call(c, traceId)).toList();
    }

    static LlmCallRow call(AnswerAiResponse.Call call, String traceId) {
        return new LlmCallRow(call.task() == null ? TASK : call.task(), call.provider(), call.model(),
                call.promptVersion(), time(call.calledAt()), call.traceId() == null ? traceId : call.traceId(),
                call.inputTokens(), call.outputTokens(), call.latencyMs() == null ? 0 : call.latencyMs(),
                call.attempt() == null ? 1 : call.attempt(), call.outcome(), call.error());
    }

    /**
     * AI 서버의 답을 저장할 결과로 판정한다. 답의 근거 표시는 여기서 다시 확인한다.
     * 알 수 없는 상태, 보낸 적 없는 근거·사실 표시, 너무 긴 답은 검토 필요다.
     *
     * @param evidenceIds 후보로 보낸 근거 ID
     * @param factRefs    보낸 사실 ref(기업 질문은 빈 집합)
     */
    static Verdict verdict(AnswerAiResponse response, Set<String> evidenceIds, Set<String> factRefs) {
        LocalDateTime generatedAt = time(response.generatedAt());
        List<String> blocked = response.blockedRules() == null ? List.of() : response.blockedRules();
        QuestionStatus status;
        try {
            status = QuestionStatus.valueOf(response.status());
        } catch (IllegalArgumentException e) {
            log.warn("AI 서버 답 상태를 알 수 없어 검토 필요로 둡니다: {}", response.status());
            return Verdict.review(UNKNOWN_STATUS, blocked, response, generatedAt);
        }
        if (status == QuestionStatus.REVIEW_NEEDED) {
            return Verdict.review(response.reviewReason(), blocked, response, generatedAt);
        }
        if (status != QuestionStatus.ANSWERED) {
            return new Verdict(status, null, List.of(), List.of(), null, blocked, response.model(),
                    response.promptVersion(), generatedAt);
        }
        AnswerMarkers.Converted converted = AnswerMarkers.convert(response.answer(), evidenceIds, factRefs);
        if (!converted.valid() || converted.answer().length() > MAX_ANSWER_CHARS) {
            log.warn("AI 서버 답의 근거 표시를 확인하지 못해 검토 필요로 둡니다");
            return Verdict.review(BAD_EVIDENCE, blocked, response, generatedAt);
        }
        return new Verdict(QuestionStatus.ANSWERED, converted.answer(), converted.evidenceIds(),
                converted.factRefs(), null, List.of(), response.model(), response.promptVersion(), generatedAt);
    }

    static LocalDateTime time(String value) {
        try {
            return value == null ? null : LocalDateTime.parse(value);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    /**
     * 판정한 답. 분석 질문·기업 질문 기록의 공통 부분이다.
     *
     * @param answer      근거 표시를 [1]·[F1]로 바꾼 답. ANSWERED가 아니면 null
     * @param evidenceIds 답이 인용한 근거 ID(인용 번호 순서)
     * @param factRefs    답이 인용한 사실 ref(번호 순서)
     */
    record Verdict(QuestionStatus status, String answer, List<String> evidenceIds, List<String> factRefs,
            String reviewReason, List<String> blockedRules, String model, String promptVersion,
            LocalDateTime generatedAt) {

        private static Verdict review(String reason, List<String> blocked, AnswerAiResponse response,
                LocalDateTime generatedAt) {
            return new Verdict(QuestionStatus.REVIEW_NEEDED, null, List.of(), List.of(),
                    reason == null ? NOT_VERIFIED : reason, blocked, response.model(), response.promptVersion(),
                    generatedAt);
        }
    }
}
