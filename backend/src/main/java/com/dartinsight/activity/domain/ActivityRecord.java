package com.dartinsight.activity.domain;

import java.time.LocalDateTime;
import java.util.List;

/** 저장한(또는 저장할) 두 보고서 사이 활동 한 건(period_activity). id는 저장 전 null */
public record ActivityRecord(Long id, Long analysisId, String promptVersion, ActivityStatus status,
        ActivityPayload payload, String reviewReason, List<String> blockedRules, String signalTableVersion,
        String model, LocalDateTime generatedAt, String traceId, LocalDateTime createdAt) {

    public ActivityRecord withId(Long newId) {
        return new ActivityRecord(newId, analysisId, promptVersion, status, payload, reviewReason, blockedRules,
                signalTableVersion, model, generatedAt, traceId, createdAt);
    }
}
