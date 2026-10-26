package com.dartinsight.briefing.domain;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 저장한 브리핑 한 건(company_briefing). status는 GENERATED 또는 REVIEW_NEEDED다.
 *
 * @param sentences REVIEW_NEEDED면 빈 목록
 */
public record BriefingRecord(Long id, String rceptNo, String promptVersion, BriefingStatus status,
        List<BriefingSentence> sentences, String reviewReason, List<String> blockedRules, String model,
        LocalDateTime generatedAt, String traceId, LocalDateTime createdAt) {

    public BriefingRecord withId(Long newId) {
        return new BriefingRecord(newId, rceptNo, promptVersion, status, sentences, reviewReason, blockedRules, model,
                generatedAt, traceId, createdAt);
    }
}
