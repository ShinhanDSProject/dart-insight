package com.dartinsight.outlook.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

/**
 * AI 서버 전망·계획 응답(POST /internal/outlooks). docs/api-spec.md 3절.
 *
 * @param status GENERATED, EMPTY, REVIEW_NEEDED
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record OutlookAiResponse(String promptVersion, String expressionRulesVersion, String model,
        String generatedAt, String status, List<Item> items, String reviewReason, List<String> blockedRules,
        List<Call> calls) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Item(String category, String summary, String quote, List<String> evidenceIds) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Call(String task, String provider, String model, String promptVersion, String calledAt,
            String traceId, Integer inputTokens, Integer outputTokens, Integer latencyMs, Integer attempt,
            String outcome, String error) {
    }
}
