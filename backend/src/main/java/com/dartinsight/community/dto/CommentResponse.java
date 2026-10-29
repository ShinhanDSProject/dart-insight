package com.dartinsight.community.dto;

import com.dartinsight.community.domain.CommunityComment;
import com.dartinsight.community.domain.ContentStatus;
import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 댓글·답글(API 명세 6.6 Comment 모양). 답글의 replies는 빈 목록이다.
 *
 * @param blind 작성자에게만 보이는 블라인드 정보. #461에서 채운다(지금은 언제나 null)
 */
public record CommentResponse(
        long commentId,
        Long parentId,
        AuthorResponse author,
        ContentStatus state,
        String body,
        int likeCount,
        boolean liked,
        Object blind,
        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss") LocalDateTime createdAt,
        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss") LocalDateTime editedAt,
        List<CommentResponse> replies) {

    /** @param viewerId 요청한 회원. 로그인하지 않았으면 null */
    public static CommentResponse of(CommunityComment comment, String nickname, Long viewerId, boolean liked,
            List<CommentResponse> replies) {
        return new CommentResponse(comment.getId(), comment.getParentId(),
                new AuthorResponse(nickname, comment.isOwnedBy(viewerId)), comment.getStatus(),
                comment.shownBody(viewerId), comment.getLikeCount(), liked, null,
                comment.getCreatedAt(), comment.getEditedAt(), List.copyOf(replies));
    }
}
