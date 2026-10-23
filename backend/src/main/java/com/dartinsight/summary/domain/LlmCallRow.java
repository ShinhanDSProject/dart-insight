package com.dartinsight.summary.domain;

import java.time.LocalDateTime;

/** AI 서버가 알려 준 LLM 호출 기록 한 건(비용 집계·감사용). */
public record LlmCallRow(String task, String provider, String model, String promptVersion, LocalDateTime calledAt,
        String traceId, Integer inputTokens, Integer outputTokens, int latencyMs, int attempt, String outcome,
        String error) {
}
