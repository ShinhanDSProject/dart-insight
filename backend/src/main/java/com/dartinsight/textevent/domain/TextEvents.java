package com.dartinsight.textevent.domain;

import java.time.Duration;

/** 주요 사건의 정해 둔 값(ADR-0050, docs/api-spec.md). */
public final class TextEvents {

    /** 사건 묶기 규칙·프롬프트·규모·순서 중 하나라도 바뀌면 올린다. 올리면 다음 시작 때 새 실행을 만든다 */
    public static final String EVENT_VERSION = "event-1";
    /** 이 기간에 이만큼 실패하면 더 시작하지 않는다 */
    public static final int MAX_FAILURES = 3;
    public static final Duration FAILURE_WINDOW = Duration.ofHours(24);

    public static final String AI_SERVER_UNAVAILABLE = "AI_SERVER_UNAVAILABLE";
    public static final String AI_LLM_UNAVAILABLE = "AI_LLM_UNAVAILABLE";
    public static final String AI_INVALID_OUTPUT = "AI_EVENTS_INVALID_OUTPUT";
    public static final String SAVE_FAILED = "ANALYSIS_EVENTS_SAVE_FAILED";
    public static final String INTERRUPTED = "ANALYSIS_EVENTS_INTERRUPTED";
    /** LLM 비용이 없어 실패 횟수에 세지 않는다 */
    public static final String BUSY = "ANALYSIS_EVENTS_BUSY";

    private TextEvents() {
    }
}
