package com.dartinsight.community.dto;

import com.dartinsight.community.domain.CommunityPost;
import com.dartinsight.community.domain.CommunityQuote;
import com.dartinsight.community.domain.ContentStatus;
import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalDateTime;

/**
 * 글(API 명세 6.6 Post 모양).
 *
 * @param quote 붙인 변경점 인용(#464). 없거나, 가렸거나 지웠고 본인이 아니면 null
 * @param blind 가려진 글의 작성자에게만 주는 블라인드 안내. 그 밖에는 null
 */
public record PostResponse(
        long postId,
        String corpCode,
        AuthorResponse author,
        ContentStatus state,
        String body,
        QuoteResponse quote,
        int likeCount,
        int commentCount,
        boolean liked,
        BlindResponse blind,
        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss") LocalDateTime createdAt,
        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss") LocalDateTime editedAt) {

    /** @param viewerId 요청한 회원. 로그인하지 않았으면 null */
    public static PostResponse of(CommunityPost post, String nickname, Long viewerId, boolean liked,
            BlindResponse blind, CommunityQuote quote) {
        QuoteResponse shownQuote = quote != null && post.showsQuoteTo(viewerId) ? QuoteResponse.from(quote) : null;
        return new PostResponse(post.getId(), post.getCorpCode(),
                new AuthorResponse(nickname, post.isOwnedBy(viewerId)), post.getStatus(),
                post.shownBody(viewerId), shownQuote, post.getLikeCount(), post.getCommentCount(), liked, blind,
                post.getCreatedAt(), post.getEditedAt());
    }
}
