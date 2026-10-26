package com.dartinsight.briefing.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

/**
 * AI 서버 브리핑 응답(POST /internal/briefings). docs/api-spec.md 3절.
 *
 * @param status GENERATED, REVIEW_NEEDED
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record BriefingAiResponse(String promptVersion, String expressionRulesVersion, String model,
        String generatedAt, String status, List<Sentence> sentences, String reviewReason, List<String> blockedRules,
        List<Call> calls) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Sentence(String text, List<String> evidenceIds) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Call(String task, String provider, String model, String promptVersion, String calledAt,
            String traceId, Integer inputTokens, Integer outputTokens, Integer latencyMs, Integer attempt,
            String outcome, String error) {
    }
}
