package com.dartinsight.followup.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

/**
 * AI 서버 약속과 실제 대조 응답(POST /internal/plan-followups). docs/api-spec.md 3절.
 *
 * @param status GENERATED, REVIEW_NEEDED
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record PlanFollowupAiResponse(String promptVersion, String expressionRulesVersion, String model,
        String generatedAt, String status, List<Followup> followups, String reviewReason, List<String> blockedRules,
        List<Call> calls) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Followup(String planId, String status, String summary, String quote, List<String> evidenceIds) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Call(String task, String provider, String model, String promptVersion, String calledAt,
            String traceId, Integer inputTokens, Integer outputTokens, Integer latencyMs, Integer attempt,
            String outcome, String error) {
    }
}
