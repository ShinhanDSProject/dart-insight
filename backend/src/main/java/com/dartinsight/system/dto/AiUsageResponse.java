package com.dartinsight.system.dto;

import com.dartinsight.question.domain.QuestionUsage;
import com.dartinsight.summary.domain.LlmCallUsage;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * AI 사용 현황(docs/api-spec.md GET /api/system/ai-usage). 집계만 담고 질문 본문·사용자 정보는 담지 않는다.
 * 비율은 여기서 계산하고, 분모가 0이면 null이다(0과 구분).
 */
public record AiUsageResponse(int days, LocalDate from, LocalDate to, Questions questions, Feedback feedback,
        Explanations explanations, LlmCalls llmCalls) {

    private static final int RATE_SCALE = 4;

    public static AiUsageResponse of(int days, LocalDate from, LocalDate to, QuestionUsage question,
            Map<? extends Enum<?>, Long> explanationsByStatus, LlmCallUsage llm) {
        Map<String, Long> questionsByStatus = named(question.byStatus());
        long rated = question.helpful() + question.notHelpful();
        Feedback feedback = new Feedback(rated, question.helpful(), question.notHelpful(),
                rate(question.helpful(), rated), named(question.reasons()));
        Map<String, Long> explanations = named(explanationsByStatus);
        List<TaskCalls> byTask = llm.byTask().stream()
                .map(t -> new TaskCalls(t.task(), t.calls(), t.inputTokens(), t.outputTokens())).toList();
        return new AiUsageResponse(days, from, to,
                new Questions(sum(questionsByStatus), questionsByStatus),
                feedback,
                new Explanations(sum(explanations), explanations),
                new LlmCalls(sum(llm.byOutcome()), llm.byOutcome(), byTask));
    }

    /** part ÷ whole, 소수 넷째 자리 반올림. whole이 0이면 null */
    static Double rate(long part, long whole) {
        if (whole == 0) {
            return null;
        }
        return BigDecimal.valueOf(part).divide(BigDecimal.valueOf(whole), RATE_SCALE, RoundingMode.HALF_UP)
                .doubleValue();
    }

    private static Map<String, Long> named(Map<? extends Enum<?>, Long> counts) {
        Map<String, Long> named = new LinkedHashMap<>();
        counts.forEach((key, value) -> named.put(key.name(), value));
        return named;
    }

    private static long sum(Map<String, Long> counts) {
        return counts.values().stream().mapToLong(Long::longValue).sum();
    }

    public record Questions(long total, Map<String, Long> byStatus) {
    }

    /** helpfulRate = helpful ÷ rated. rated가 0이면 null */
    public record Feedback(long rated, long helpful, long notHelpful, Double helpfulRate, Map<String, Long> reasons) {
    }

    public record Explanations(long total, Map<String, Long> byStatus) {
    }

    public record LlmCalls(long total, Map<String, Long> byOutcome, List<TaskCalls> byTask) {
    }

    /** inputTokens·outputTokens는 그 작업의 호출이 모두 토큰을 모르면 null */
    public record TaskCalls(String task, long calls, Long inputTokens, Long outputTokens) {
    }
}
