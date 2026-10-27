package com.dartinsight.outlook.domain;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 저장한 전망·계획 한 건(company_outlook). status는 GENERATED, EMPTY, REVIEW_NEEDED 중 하나다.
 *
 * @param items GENERATED가 아니면 빈 목록
 */
public record OutlookRecord(Long id, String rceptNo, String promptVersion, OutlookStatus status,
        List<OutlookItem> items, String reviewReason, List<String> blockedRules, String model,
        LocalDateTime generatedAt, String traceId, LocalDateTime createdAt) {

    public OutlookRecord withId(Long newId) {
        return new OutlookRecord(newId, rceptNo, promptVersion, status, items, reviewReason, blockedRules, model,
                generatedAt, traceId, createdAt);
    }
}
