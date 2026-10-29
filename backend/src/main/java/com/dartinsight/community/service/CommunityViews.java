package com.dartinsight.community.service;

import com.dartinsight.community.domain.CommentThread;
import com.dartinsight.community.domain.CommunityComment;
import com.dartinsight.community.domain.CommunityPost;
import com.dartinsight.community.domain.LikeTarget;
import com.dartinsight.community.dto.CommentResponse;
import com.dartinsight.community.dto.PostResponse;
import com.dartinsight.community.repository.CommunityLikeRepository;
import com.dartinsight.user.service.UserService;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 글·댓글 행을 응답으로 바꾼다. 작성자는 닉네임으로만, 요청한 회원 기준으로 mine·liked·본문 공개를 정한다.
 * 부른 쪽 트랜잭션 안에서 쓴다.
 */
@Component
@RequiredArgsConstructor
class CommunityViews {
    private final UserService userService;
    private final CommunityLikeRepository likes;

    /** @param viewerId 요청한 회원. 로그인하지 않았으면 null */
    List<PostResponse> posts(List<CommunityPost> posts, Long viewerId) {
        Map<Long, String> nicknames = userService.nicknames(posts.stream().map(CommunityPost::getUserId).toList());
        Set<Long> liked = liked(LikeTarget.POST, posts.stream().map(CommunityPost::getId).toList(), viewerId);
        return posts.stream()
                .map(post -> PostResponse.of(post, nicknames.get(post.getUserId()), viewerId,
                        liked.contains(post.getId())))
                .toList();
    }

    PostResponse post(CommunityPost post, Long viewerId) {
        return posts(List.of(post), viewerId).getFirst();
    }

    List<CommentResponse> threads(List<CommentThread> threads, Long viewerId) {
        List<CommunityComment> all = threads.stream()
                .flatMap(thread -> Stream.concat(Stream.of(thread.comment()), thread.replies().stream()))
                .toList();
        Map<Long, String> nicknames = userService.nicknames(all.stream().map(CommunityComment::getUserId).toList());
        Set<Long> liked = liked(LikeTarget.COMMENT, all.stream().map(CommunityComment::getId).toList(), viewerId);
        return threads.stream()
                .map(thread -> comment(thread.comment(), nicknames, liked, viewerId,
                        thread.replies().stream()
                                .map(reply -> comment(reply, nicknames, liked, viewerId, List.of()))
                                .toList()))
                .toList();
    }

    CommentResponse thread(CommentThread thread, Long viewerId) {
        return threads(List.of(thread), viewerId).getFirst();
    }

    private static CommentResponse comment(CommunityComment comment, Map<Long, String> nicknames, Set<Long> liked,
            Long viewerId, List<CommentResponse> replies) {
        return CommentResponse.of(comment, nicknames.get(comment.getUserId()), viewerId,
                liked.contains(comment.getId()), replies);
    }

    private Set<Long> liked(LikeTarget target, Collection<Long> targetIds, Long viewerId) {
        if (viewerId == null || targetIds.isEmpty()) return Set.of();
        return new HashSet<>(likes.findLikedTargetIds(target, viewerId, targetIds));
    }
}
