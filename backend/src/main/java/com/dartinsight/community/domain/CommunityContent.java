package com.dartinsight.community.domain;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import java.time.LocalDateTime;

/** 신고·관리자 처리 대상이 되는 글·댓글(6.6 #461). 두 엔티티가 같은 규칙을 쓴다. */
public interface CommunityContent {
    TargetType targetType();

    Long getId();

    /** 대상이 속한 글. 글이면 자기 ID */
    Long boardPostId();

    Long getUserId();

    ContentStatus getStatus();

    /** 가렸거나 지운 것도 남아 있는 본문(관리자 신고 목록에 씀) */
    String getBody();

    /**
     * 관리자 처리를 대상에 적용한다(ContentStatus.moderated). 삭제는 작성자가 지운 것과 같다.
     *
     * @return 이번에 새로 지웠으면 true(댓글이면 글의 댓글 수를 뺀다)
     */
    boolean moderate(ModerationDecision decision, LocalDateTime now);

    default boolean isOwnedBy(Long viewerId) {
        return getUserId().equals(viewerId);
    }

    /** 보이는 남의 글·댓글만 신고한다 */
    default void requireReportableBy(long userId) {
        if (isOwnedBy(userId)) throw new ApiException(ErrorCode.COMMUNITY_FORBIDDEN, "내 글·댓글은 신고할 수 없습니다.");
        if (getStatus() != ContentStatus.VISIBLE) throw new ApiException(ErrorCode.COMMUNITY_TARGET_UNAVAILABLE);
    }

    /** 가려진 내 글·댓글만 재게시를 청구한다 */
    default void requireRepostableBy(long userId) {
        if (!isOwnedBy(userId)) {
            throw new ApiException(ErrorCode.COMMUNITY_FORBIDDEN, "가려진 글·댓글의 작성자만 재게시를 청구할 수 있습니다.");
        }
        if (getStatus() != ContentStatus.BLINDED) throw new ApiException(ErrorCode.COMMUNITY_REPOST_NOT_ALLOWED);
    }
}
