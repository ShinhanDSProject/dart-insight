package com.dartinsight.summary.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

/** AI 서버 요약 응답(POST /internal/summaries). docs/api-spec.md 3절 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record SummaryAiResponse(String promptVersion, String model, String generatedAt, List<Item> items,
        List<Call> calls) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Item(String ref, String kind, String status, String sentence, String explanation,
            List<String> evidenceIds, String reviewReason, List<String> blockedRules) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Call(String task, String provider, String model, String promptVersion, String calledAt,
            String traceId, Integer inputTokens, Integer outputTokens, Integer latencyMs, Integer attempt,
            String outcome, String error) {
    }
}
