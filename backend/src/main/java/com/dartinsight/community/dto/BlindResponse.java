package com.dartinsight.community.dto;

import com.dartinsight.community.domain.CommunityModeration;
import com.dartinsight.community.domain.ReportState;
import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalDateTime;

/**
 * 가려진 글·댓글의 작성자에게만 주는 블라인드 안내(API 명세 6.6 Post.blind).
 *
 * @param expired 기한이 지났지만 관리자가 아직 다시 처리하지 않음(가린 채 둠)
 */
public record BlindResponse(
        long reportId,
        String reason,
        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss") LocalDateTime blindUntil,
        boolean expired,
        boolean repostRequested) {

    public static BlindResponse of(ReportState state, LocalDateTime now) {
        return new BlindResponse(state.report().getId(),
                state.lastModeration().map(CommunityModeration::getReason).orElse(null),
                state.report().getBlindUntil(), state.report().isExpired(now), state.repostRequested());
    }
}
