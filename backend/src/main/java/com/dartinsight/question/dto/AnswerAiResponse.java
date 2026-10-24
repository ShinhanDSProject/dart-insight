package com.dartinsight.question.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

/**
 * AI 서버 답 응답(POST /internal/answers). docs/api-spec.md 3절.
 *
 * @param status ANSWERED, NOT_FOUND, OUT_OF_SCOPE, REVIEW_NEEDED
 * @param answer 근거 표시가 [근거 ID]·[F1]로 남은 답. ANSWERED가 아니면 null
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record AnswerAiResponse(String promptVersion, String expressionRulesVersion, String model,
        String generatedAt, String status, String answer, List<String> evidenceIds, List<String> factRefs,
        String reviewReason, List<String> blockedRules, List<Call> calls) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Call(String task, String provider, String model, String promptVersion, String calledAt,
            String traceId, Integer inputTokens, Integer outputTokens, Integer latencyMs, Integer attempt,
            String outcome, String error) {
    }
}
