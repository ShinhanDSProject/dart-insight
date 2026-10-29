package com.dartinsight.community.dto;

import com.dartinsight.community.domain.CommunityModeration;
import com.dartinsight.community.domain.ModerationDecision;
import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalDateTime;

/** 처리 기록 한 줄(관리자 신고 목록의 moderations) */
public record ModerationResponse(
        ModerationDecision decision,
        String reason,
        Integer blindDays,
        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss") LocalDateTime blindUntil,
        MemberResponse admin,
        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss") LocalDateTime createdAt) {

    public static ModerationResponse of(CommunityModeration moderation, String adminNickname) {
        return new ModerationResponse(moderation.getDecision(), moderation.getReason(), moderation.getBlindDays(),
                moderation.getBlindUntil(), new MemberResponse(adminNickname), moderation.getCreatedAt());
    }
}
