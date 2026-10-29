package com.dartinsight.community.dto;

import com.dartinsight.community.domain.CommunityComment;
import com.dartinsight.community.domain.ContentStatus;
import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 댓글·답글(API 명세 6.6 Comment 모양). 답글의 replies는 빈 목록이다.
 *
 * @param blind 가려진 댓글의 작성자에게만 주는 블라인드 안내. 그 밖에는 null
 */
public record CommentResponse(
        long commentId,
        Long parentId,
        AuthorResponse author,
        ContentStatus state,
        String body,
        int likeCount,
        boolean liked,
        BlindResponse blind,
        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss") LocalDateTime createdAt,
        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss") LocalDateTime editedAt,
        List<CommentResponse> replies) {

    /** @param viewerId 요청한 회원. 로그인하지 않았으면 null */
    public static CommentResponse of(CommunityComment comment, String nickname, Long viewerId, boolean liked,
            BlindResponse blind, List<CommentResponse> replies) {
        return new CommentResponse(comment.getId(), comment.getParentId(),
                new AuthorResponse(nickname, comment.isOwnedBy(viewerId)), comment.getStatus(),
                comment.shownBody(viewerId), comment.getLikeCount(), liked, blind,
                comment.getCreatedAt(), comment.getEditedAt(), List.copyOf(replies));
    }
}
