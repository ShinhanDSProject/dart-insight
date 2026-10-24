package com.dartinsight.summary.domain;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 한 기간의 LLM 호출 집계(AI 사용 현황, FS-15). 다시 만든 호출도 한 번씩 센다.
 *
 * @param byOutcome 결과별 호출 수. {@link #OUTCOMES}가 늘 앞에 키로 있고(없으면 0), 그 밖의 값이 기록돼 있으면 그 값도 들어간다
 * @param byTask 작업별 호출 수와 토큰 합(작업 이름 순서)
 */
public record LlmCallUsage(Map<String, Long> byOutcome, List<TaskUsage> byTask) {

    /** llm_call.outcome으로 기록하는 값(docs/erd.md) */
    public static final List<String> OUTCOMES = List.of("OK", "INVALID_OUTPUT", "TRANSIENT_ERROR", "ERROR");

    public LlmCallUsage {
        byOutcome = Collections.unmodifiableMap(new LinkedHashMap<>(byOutcome));
        byTask = List.copyOf(byTask);
    }

    /**
     * 작업 하나의 집계.
     *
     * @param inputTokens 제공자가 알려 준 호출의 입력 토큰 합. 그 작업의 호출이 모두 토큰을 모르면 null
     * @param outputTokens 출력 토큰 합. 위와 같다
     */
    public record TaskUsage(String task, long calls, Long inputTokens, Long outputTokens) {
    }
}
