package com.dartinsight.community.domain;

import com.dartinsight.common.error.ApiException;

/**
 * 관리자 처리 요청(PATCH /api/admin/reports/{reportId}). 블라인드 기간은 블라인드일 때만 쓰고 그 밖에는 버린다.
 *
 * @param blindDays 블라인드면 1~30, 아니면 null
 */
public record ModerationCommand(ModerationDecision decision, String reason, Integer blindDays) {
    public static final int MAX_BLIND_DAYS = 30;

    public static ModerationCommand of(Object rawDecision, Object rawReason, Object rawBlindDays) {
        ModerationDecision decision = ModerationDecision.of(rawDecision);
        String reason = CommunityText.moderationReason(rawReason);
        Integer blindDays = decision == ModerationDecision.BLIND ? blindDays(rawBlindDays) : null;
        return new ModerationCommand(decision, reason, blindDays);
    }

    private static int blindDays(Object raw) {
        if (!(raw instanceof Integer days) || days < 1 || days > MAX_BLIND_DAYS) {
            throw ApiException.invalidInput("blindDays", "블라인드는 1~30일로 정해 주세요.");
        }
        return days;
    }
}
