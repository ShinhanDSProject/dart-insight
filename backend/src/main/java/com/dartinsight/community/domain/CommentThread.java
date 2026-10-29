package com.dartinsight.community.domain;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 댓글 하나와 그 답글(한 단계). 글 화면에 보일 댓글만 남긴다: 지운 답글은 빼고,
 * 지운 댓글은 지우지 않은 답글이 있을 때만 '삭제된 댓글입니다'로 남긴다(API 명세 GET /api/posts/{postId}).
 */
public record CommentThread(CommunityComment comment, List<CommunityComment> replies) {

    /** @param comments 한 글의 모든 댓글·답글, 오래된 순 */
    public static List<CommentThread> of(List<CommunityComment> comments) {
        Map<Long, List<CommunityComment>> repliesByParent = new LinkedHashMap<>();
        for (CommunityComment comment : comments) {
            if (comment.isReply() && !comment.isDeleted()) {
                repliesByParent.computeIfAbsent(comment.getParentId(), key -> new ArrayList<>()).add(comment);
            }
        }
        return comments.stream()
                .filter(comment -> !comment.isReply())
                .map(comment -> new CommentThread(comment,
                        List.copyOf(repliesByParent.getOrDefault(comment.getId(), List.of()))))
                .filter(thread -> !thread.comment.isDeleted() || !thread.replies.isEmpty())
                .toList();
    }
}
