package com.dartinsight.community.service;

import com.dartinsight.community.domain.CommunityComment;
import com.dartinsight.community.domain.CommunityLike;
import com.dartinsight.community.domain.CommunityPost;
import com.dartinsight.community.domain.LikeTarget;
import com.dartinsight.community.dto.LikeResponse;
import com.dartinsight.community.repository.CommunityCommentRepository;
import com.dartinsight.community.repository.CommunityLikeRepository;
import com.dartinsight.community.repository.CommunityPostRepository;
import com.dartinsight.user.service.UserService;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 글·댓글 좋아요(6.6 #460). 대상 행을 잠근 채 누름 여부를 보고 고쳐, 같은 회원이 동시에 눌러도 한 번만 더한다
 * (DB UNIQUE uk_community_like_target_user가 한 번 더 막는다). 누르기는 보이는 대상에만, 취소는 언제든 된다.
 *
 * <p>잠금은 트랜잭션의 첫 조회여야 한다. MariaDB(REPEATABLE READ)는 첫 일반 조회 때 스냅샷을 잡으므로, 그보다 먼저
 * 일반 조회를 하면 잠금을 기다리는 사이 다른 트랜잭션이 넣은 좋아요가 뒤의 누름 여부 조회에 보이지 않는다.
 */
@Service
@RequiredArgsConstructor
public class CommunityLikeService {
    private final CommunityPostRepository posts;
    private final CommunityCommentRepository comments;
    private final CommunityLikeRepository likes;
    private final UserService userService;
    private final Clock clock;

    @Transactional
    public LikeResponse likePost(long postId, long userId) {
        CommunityPost post = lockedPost(postId);
        userService.requireExisting(userId);
        if (find(LikeTarget.POST, postId, userId).isEmpty()) {
            post.requireVisible();
            likes.save(CommunityLike.create(LikeTarget.POST, postId, userId, LocalDateTime.now(clock)));
            post.addLike();
        }
        return new LikeResponse(true, post.getLikeCount());
    }

    @Transactional
    public LikeResponse unlikePost(long postId, long userId) {
        CommunityPost post = lockedPost(postId);
        userService.requireExisting(userId);
        find(LikeTarget.POST, postId, userId).ifPresent(like -> {
            likes.delete(like);
            post.removeLike();
        });
        return new LikeResponse(false, post.getLikeCount());
    }

    @Transactional
    public LikeResponse likeComment(long commentId, long userId) {
        CommunityComment comment = lockedComment(commentId);
        userService.requireExisting(userId);
        if (find(LikeTarget.COMMENT, commentId, userId).isEmpty()) {
            comment.requireVisible();
            likes.save(CommunityLike.create(LikeTarget.COMMENT, commentId, userId, LocalDateTime.now(clock)));
            comment.addLike();
        }
        return new LikeResponse(true, comment.getLikeCount());
    }

    @Transactional
    public LikeResponse unlikeComment(long commentId, long userId) {
        CommunityComment comment = lockedComment(commentId);
        userService.requireExisting(userId);
        find(LikeTarget.COMMENT, commentId, userId).ifPresent(like -> {
            likes.delete(like);
            comment.removeLike();
        });
        return new LikeResponse(false, comment.getLikeCount());
    }

    private Optional<CommunityLike> find(LikeTarget target, long targetId, long userId) {
        return likes.findByTargetTypeAndTargetIdAndUserId(target, targetId, userId);
    }

    private CommunityPost lockedPost(long postId) {
        return posts.findByIdForUpdate(postId).orElseThrow(CommunityPostService::postNotFound);
    }

    private CommunityComment lockedComment(long commentId) {
        return comments.findByIdForUpdate(commentId).orElseThrow(CommunityCommentService::commentNotFound);
    }
}
