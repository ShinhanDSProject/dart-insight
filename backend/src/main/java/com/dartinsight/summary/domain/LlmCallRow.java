package com.dartinsight.summary.domain;

import java.time.LocalDateTime;

/**
 * AI 서버가 알려 준 LLM 호출 기록 한 건(비용 집계·감사용).
 *
 * @param cachedInputTokens inputTokens 중 프롬프트 캐시에서 읽은 토큰(#633). 모르면 null
 * @param reasoningTokens   outputTokens 중 추론 토큰(#633). 모르면 null
 */
public record LlmCallRow(String task, String provider, String model, String promptVersion, LocalDateTime calledAt,
        String traceId, Integer inputTokens, Integer outputTokens, int latencyMs, int attempt, String outcome,
        String error, Integer cachedInputTokens, Integer reasoningTokens) {

    /** 세부 토큰을 받지 않는 작업(지금은 에이전트 채팅 밖의 작업)의 기록. 세부 토큰은 null로 둔다 */
    public LlmCallRow(String task, String provider, String model, String promptVersion, LocalDateTime calledAt,
            String traceId, Integer inputTokens, Integer outputTokens, int latencyMs, int attempt, String outcome,
            String error) {
        this(task, provider, model, promptVersion, calledAt, traceId, inputTokens, outputTokens, latencyMs, attempt,
                outcome, error, null, null);
    }
}
