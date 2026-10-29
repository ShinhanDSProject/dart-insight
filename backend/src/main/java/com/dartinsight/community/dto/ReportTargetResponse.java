package com.dartinsight.community.dto;

import com.dartinsight.community.domain.CommunityContent;
import com.dartinsight.community.domain.ContentStatus;
import com.dartinsight.community.domain.TargetType;

/**
 * 신고된 글·댓글(관리자 신고 목록의 target). 관리자가 판단하도록 가렸거나 지운 본문도 그대로 준다.
 *
 * @param commentId 댓글이면 그 ID, 글이면 null
 */
public record ReportTargetResponse(
        TargetType type,
        long postId,
        Long commentId,
        String corpCode,
        String corpName,
        MemberResponse author,
        String body,
        ContentStatus state) {

    public static ReportTargetResponse of(CommunityContent target, String corpCode, String corpName,
            String authorNickname) {
        return new ReportTargetResponse(target.targetType(), target.boardPostId(),
                target.targetType() == TargetType.COMMENT ? target.getId() : null, corpCode, corpName,
                new MemberResponse(authorNickname), target.getBody(), target.getStatus());
    }
}
