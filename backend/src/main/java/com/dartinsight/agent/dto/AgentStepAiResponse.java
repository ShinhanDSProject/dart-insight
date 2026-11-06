package com.dartinsight.agent.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.Map;

/**
 * AI 서버 에이전트 한 단계 응답(POST /internal/agent-steps). docs/api-spec.md 3절.
 *
 * @param type        TOOL_CALLS, FINAL, OUT_OF_SCOPE
 * @param finalAnswer type이 FINAL일 때만
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record AgentStepAiResponse(String promptVersion, String expressionRulesVersion, String model,
        String generatedAt, String type, List<ToolCall> toolCalls, @JsonProperty("final") Final finalAnswer,
        List<Rejection> rejections, List<Call> calls) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ToolCall(String callId, String name, Map<String, Object> arguments) {
    }

    /**
     * @param status  ANSWERED, NOT_FOUND, REVIEW_NEEDED
     * @param answer  근거 표시가 [근거 ID]로 남은 답
     * @param actions type과 그 액션의 필드
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Final(String status, String answer, List<String> evidenceIds, List<Map<String, Object>> actions,
            String reviewReason, List<String> blockedRules, String format, Object crossCheck) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Rejection(Integer attempt, List<String> rules) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Call(String task, String provider, String model, String promptVersion, String calledAt,
            String traceId, Integer inputTokens, Integer outputTokens, Integer latencyMs, Integer attempt,
            String outcome, String error, Integer cachedInputTokens, Integer reasoningTokens) {
    }
}
