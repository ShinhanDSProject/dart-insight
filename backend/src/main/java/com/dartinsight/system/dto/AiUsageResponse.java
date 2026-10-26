package com.dartinsight.system.dto;

import com.dartinsight.question.domain.QuestionUsage;
import com.dartinsight.summary.domain.LlmCallUsage;
import com.dartinsight.summary.domain.LlmCallUsage.ModelTokens;
import com.dartinsight.summary.domain.LlmCallUsage.TaskUsage;
import com.dartinsight.summary.domain.LlmCallUsage.UnitUsage;
import com.dartinsight.system.config.AiUsageProperties;
import com.dartinsight.system.domain.ModelPrice;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * AI 사용 현황(docs/api-spec.md GET /api/system/ai-usage). 집계만 담고 질문 본문·사용자 정보는 담지 않는다.
 * 비율·추정 비용·1건당 평균은 여기서 계산하고, 분모가 0이거나 가격 설정이 없으면 null이다(0과 구분).
 */
public record AiUsageResponse(int days, LocalDate from, LocalDate to, Questions questions, Feedback feedback,
        Explanations explanations, LlmCalls llmCalls) {

    private static final int RATE_SCALE = 4;
    private static final int COST_SCALE = 4;

    public static AiUsageResponse of(int days, LocalDate from, LocalDate to, QuestionUsage question,
            Map<? extends Enum<?>, Long> explanationsByStatus, LlmCallUsage llm, AiUsageProperties pricing) {
        Map<String, Long> questionsByStatus = named(question.byStatus());
        long rated = question.helpful() + question.notHelpful();
        Feedback feedback = new Feedback(rated, question.helpful(), question.notHelpful(),
                rate(question.helpful(), rated), named(question.reasons()));
        Map<String, Long> explanations = named(explanationsByStatus);
        List<TaskCalls> byTask = taskCalls(llm.byTask());
        List<ModelCalls> byModel = llm.byModel().stream()
                .map(m -> new ModelCalls(m.provider(), m.model(), m.calls(), m.inputTokens(), m.outputTokens(),
                        cost(pricing.price(m.provider(), m.model()), m.inputTokens(), m.outputTokens()),
                        taskCalls(m.byTask())))
                .toList();
        PerUnit perUnit = new PerUnit(unitAverage(llm.analyses(), pricing), unitAverage(llm.briefings(), pricing));
        return new AiUsageResponse(days, from, to,
                new Questions(sum(questionsByStatus), questionsByStatus),
                feedback,
                new Explanations(sum(explanations), explanations),
                new LlmCalls(sum(llm.byOutcome()), llm.byOutcome(), byTask, byModel, perUnit));
    }

    private static List<TaskCalls> taskCalls(List<TaskUsage> tasks) {
        return tasks.stream().map(t -> new TaskCalls(t.task(), t.calls(), t.inputTokens(), t.outputTokens())).toList();
    }

    /** 가격 설정이 있고 토큰을 하나라도 알면 추정 비용(USD, 소수 넷째 자리 반올림). 아니면 null */
    static Double cost(Optional<ModelPrice> price, Long inputTokens, Long outputTokens) {
        if (price.isEmpty() || (inputTokens == null && outputTokens == null)) {
            return null;
        }
        return price.get().cost(inputTokens, outputTokens).setScale(COST_SCALE, RoundingMode.HALF_UP).doubleValue();
    }

    /**
     * 단위들의 합 ÷ 단위 수. 토큰 평균은 정수로, 비용 평균은 소수 넷째 자리로 반올림한다.
     * 단위가 없거나 토큰을 모두 모르면 null, 가격 설정이 없는 모델의 호출이 하나라도 있으면 비용 평균은 null이다.
     */
    static UnitAverage unitAverage(UnitUsage unit, AiUsageProperties pricing) {
        if (unit.count() == 0) {
            return new UnitAverage(0, null, null, null);
        }
        Long input = null;
        Long output = null;
        BigDecimal totalCost = BigDecimal.ZERO;
        boolean allPriced = true;
        for (ModelTokens m : unit.byModel()) {
            input = add(input, m.inputTokens());
            output = add(output, m.outputTokens());
            Optional<ModelPrice> price = pricing.price(m.provider(), m.model());
            if (price.isEmpty()) {
                allPriced = false;
            } else {
                totalCost = totalCost.add(price.get().cost(m.inputTokens(), m.outputTokens()));
            }
        }
        BigDecimal count = BigDecimal.valueOf(unit.count());
        Double avgCost = allPriced && (input != null || output != null)
                ? totalCost.divide(count, COST_SCALE, RoundingMode.HALF_UP).doubleValue()
                : null;
        return new UnitAverage(unit.count(), average(input, count), average(output, count), avgCost);
    }

    private static Long add(Long sum, Long value) {
        if (value == null) {
            return sum;
        }
        return sum == null ? value : sum + value;
    }

    private static Long average(Long sum, BigDecimal count) {
        return sum == null ? null : BigDecimal.valueOf(sum).divide(count, 0, RoundingMode.HALF_UP).longValue();
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

    public record LlmCalls(long total, Map<String, Long> byOutcome, List<TaskCalls> byTask, List<ModelCalls> byModel,
            PerUnit perUnit) {
    }

    /** inputTokens·outputTokens는 그 작업의 호출이 모두 토큰을 모르면 null */
    public record TaskCalls(String task, long calls, Long inputTokens, Long outputTokens) {
    }

    /** 제공자·모델별 집계(FS-50). estimatedCostUsd는 가격 설정이 없거나 토큰을 모두 모르면 null */
    public record ModelCalls(String provider, String model, long calls, Long inputTokens, Long outputTokens,
            Double estimatedCostUsd, List<TaskCalls> byTask) {
    }

    /** 분석·브리핑 1건당 평균(FS-50) */
    public record PerUnit(UnitAverage analysis, UnitAverage briefing) {
    }

    /** count는 기간 안에 호출이 하나라도 있는 단위 수. 평균은 count가 0이거나 값을 모르면 null */
    public record UnitAverage(long count, Long avgInputTokens, Long avgOutputTokens, Double avgCostUsd) {
    }
}
