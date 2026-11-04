package com.dartinsight.system.domain;

import com.dartinsight.summary.domain.LlmCallUsage;
import com.dartinsight.summary.domain.LlmCallUsage.ModelUsage;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Optional;
import java.util.function.BiFunction;

/**
 * 한 기간의 LLM 호출 합계(관리자 개요). 비용은 AI 사용 현황과 같은 모델 가격({@link ModelPrice#cost})으로 계산한다.
 *
 * @param failedCalls outcome이 OK가 아닌 호출 수
 * @param estimatedCostUsd 가격이 설정된 모델의 호출만 더한 추정 비용(USD, 소수 넷째 자리 반올림). 그런 호출이 없으면 null
 * @param unpricedCalls 가격이 없는 모델(가짜 제공자 포함)의 호출 수. 0이 아니면 비용이 전부가 아니다
 */
public record LlmCallTotals(long calls, long failedCalls, Double estimatedCostUsd, long unpricedCalls) {

    private static final int COST_SCALE = 4;
    private static final String OK = "OK";

    /** @param prices 제공자·모델 → 가격. 설정이 없으면 비어 있다 */
    public static LlmCallTotals of(LlmCallUsage usage, BiFunction<String, String, Optional<ModelPrice>> prices) {
        long calls = usage.byOutcome().values().stream().mapToLong(Long::longValue).sum();
        long failed = calls - usage.byOutcome().getOrDefault(OK, 0L);
        BigDecimal cost = BigDecimal.ZERO;
        long pricedCalls = 0;
        long unpriced = 0;
        for (ModelUsage model : usage.byModel()) {
            Optional<ModelPrice> price = prices.apply(model.provider(), model.model());
            if (price.isEmpty()) {
                unpriced += model.calls();
            } else {
                pricedCalls += model.calls();
                cost = cost.add(price.get().cost(model.inputTokens(), model.outputTokens()));
            }
        }
        Double estimated = pricedCalls == 0 ? null
                : cost.setScale(COST_SCALE, RoundingMode.HALF_UP).doubleValue();
        return new LlmCallTotals(calls, failed, estimated, unpriced);
    }
}
