package com.dartinsight.followup.domain;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 저장한 약속과 실제 대조 한 건(plan_followup). status는 GENERATED 또는 REVIEW_NEEDED다.
 *
 * @param items GENERATED가 아니면 빈 목록
 */
public record PlanFollowupRecord(Long id, String previousRceptNo, String currentRceptNo, String promptVersion,
        PlanFollowupStatus status, List<PlanFollowupItem> items, String reviewReason, List<String> blockedRules,
        String model, LocalDateTime generatedAt, String traceId, LocalDateTime createdAt) {

    public PlanFollowupRecord withId(Long newId) {
        return new PlanFollowupRecord(newId, previousRceptNo, currentRceptNo, promptVersion, status, items,
                reviewReason, blockedRules, model, generatedAt, traceId, createdAt);
    }
}
