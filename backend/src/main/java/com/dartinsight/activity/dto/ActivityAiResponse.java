package com.dartinsight.activity.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

/**
 * AI 서버 두 보고서 사이 활동 응답(POST /internal/period-activities). docs/api-spec.md 3장.
 *
 * @param status GENERATED, EMPTY, REVIEW_NEEDED
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ActivityAiResponse(String promptVersion, String expressionRulesVersion, String signalTableVersion,
        String model, String generatedAt, String status, Overview overview, List<Item> items, Integer droppedCount,
        Integer candidateCount, String reviewReason, List<String> blockedRules, List<Call> calls) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Overview(String text, List<String> evidenceIds) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Item(String area, List<String> audiences, String title, String summary, List<Quote> facts,
            String signal, String holdReason, String signalKind, String signalKindName, String signalChange,
            String signalChangeName, String signalEvidenceId, List<Impact> impacts, List<Integer> changeNos) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Quote(String quote, String evidenceId) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Impact(String kind, String tone, String text, List<Quote> premises) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Call(String task, String provider, String model, String promptVersion, String calledAt,
            String traceId, Integer inputTokens, Integer outputTokens, Integer cachedInputTokens,
            Integer reasoningTokens, Integer latencyMs, Integer attempt, String outcome, String error) {
    }
}
