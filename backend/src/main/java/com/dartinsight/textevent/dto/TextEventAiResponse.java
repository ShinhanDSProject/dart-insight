package com.dartinsight.textevent.dto;

import java.math.BigDecimal;
import java.util.List;

/** 주요 사건 응답(POST /internal/text-events, docs/api-spec.md 3장). 저장 전에 backend가 다시 확인한다. */
public record TextEventAiResponse(boolean created, String notCreatedReason, String model, String promptVersion,
        String generatedAt, int droppedEventCount, List<Event> events, List<Integer> unboundChangeNos,
        List<Call> calls) {

    public record Event(int sortOrder, String title, String kind, List<Integer> changeNos, List<Quote> quotes,
            Long scaleAmount, String scaleAmountText, String currency, Long scaleAmountKrw, BigDecimal scaleRatio,
            String scaleNotComputedReason, String scaleEvidenceId, String amountSource, String fxSource,
            String fxRateDate, String sortBasis) {
    }

    public record Quote(int changeNo, String purpose, String side, String text, String evidenceId) {
    }

    public record Call(String task, String provider, String model, String promptVersion, String calledAt,
            String traceId, Integer inputTokens, Integer outputTokens, Integer latencyMs, Integer attempt,
            String outcome, String error) {
    }
}
