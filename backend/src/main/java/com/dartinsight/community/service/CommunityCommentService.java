package com.dartinsight.community.service;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.community.domain.CommentThread;
import com.dartinsight.community.domain.CommunityComment;
import com.dartinsight.community.domain.CommunityPost;
import com.dartinsight.community.domain.CommunityText;
import com.dartinsight.community.domain.ContentStatus;
import com.dartinsight.community.dto.CommentResponse;
import com.dartinsight.community.repository.CommunityCommentRepository;
import com.dartinsight.community.repository.CommunityPostRepository;
import com.dartinsight.user.service.UserService;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 글의 댓글·답글(6.6 #460). 글의 댓글 수는 글 행을 잠근 채 고친다.
 * 지운 댓글은 지우지 않은 답글이 있을 때만 '삭제된 댓글'로 남고, 아니면 없는 댓글과 같다(404).
 *
 * <p>잠금 순서는 언제나 글 → 댓글이고, 잠금이 트랜잭션의 첫 조회다(CommunityLikeService와 같은 이유).
 * 고치기도 행을 잠근다. 엔티티는 모든 칼럼을 다시 쓰므로, 잠그지 않으면 그사이 바뀐 좋아요 수·상태를 덮는다.
 */
@Service
@RequiredArgsConstructor
public class CommunityCommentService {
    private final CommunityPostRepository posts;
    private final CommunityCommentRepository comments;
    private final CommunityViews views;
    private final UserService userService;
    private final Clock clock;

    /** 글이 보일 때만 쓴다. 답글에 다시 답글을 달면 400(parentId) */
    @Transactional
    public CommentResponse create(long postId, long userId, Object rawBody, Long parentId) {
        String body = CommunityText.commentBody(rawBody);
        CommunityPost post = posts.findByIdForUpdate(postId).orElseThrow(CommunityPostService::postNotFound);
        userService.requireNickname(userId);
        if (post.isGone()) throw CommunityPostService.postNotFound();
        post.requireVisible();
        CommunityComment parent = parentId == null ? null : comments.findByIdForUpdate(parentId)
                .filter(candidate -> !isGone(candidate))
                .orElseThrow(() -> ApiException.invalidInput("parentId", "이 글의 댓글이 아닙니다."));
        CommunityComment comment = comments.save(
                CommunityComment.create(post, parent, userId, body, LocalDateTime.now(clock)));
        post.addComment();
        return views.thread(new CommentThread(comment, List.of()), userId);
    }

    @Transactional
    public CommentResponse edit(long commentId, long userId, Object rawBody) {
        String body = CommunityText.commentBody(rawBody);
        CommunityComment comment = comments.findByIdForUpdate(commentId)
                .filter(found -> !isGone(found))
                .orElseThrow(CommunityCommentService::commentNotFound);
        comment.requireOwner(userId);
        comment.edit(body, LocalDateTime.now(clock));
        return views.thread(threadOf(comment), userId);
    }

    /** 이미 지운 댓글이어도 작성자면 그대로 끝난다. 글 → 댓글 순으로 잠가 같은 댓글을 두 번 빼지 않는다 */
    @Transactional
    public void delete(long commentId, long userId) {
        long postId = comments.findPostIdById(commentId).orElseThrow(CommunityCommentService::commentNotFound);
        CommunityPost post = posts.findByIdForUpdate(postId)
                .orElseThrow(() -> new IllegalStateException("comment without post: " + commentId));
        CommunityComment comment = comments.findByIdForUpdate(commentId)
                .orElseThrow(CommunityCommentService::commentNotFound);
        comment.requireOwner(userId);
        if (comment.delete(LocalDateTime.now(clock))) post.removeComment();
    }

    /** 지웠고 보일 답글도 없는 댓글은 없는 댓글과 같다 */
    private boolean isGone(CommunityComment comment) {
        return comment.isDeleted()
                && (comment.isReply() || !comments.existsByParentIdAndStatusNot(comment.getId(), ContentStatus.DELETED));
    }

    /** 댓글이면 지금 보이는 답글과 함께, 답글이면 그것만 */
    private CommentThread threadOf(CommunityComment comment) {
        if (comment.isReply()) return new CommentThread(comment, List.of());
        List<CommunityComment> thread = new ArrayList<>();
        thread.add(comment);
        thread.addAll(comments.findByParentIdOrderByCreatedAtAscIdAsc(comment.getId()));
        return CommentThread.of(thread).getFirst();
    }

    static ApiException commentNotFound() {
        return new ApiException(ErrorCode.COMMUNITY_COMMENT_NOT_FOUND);
    }
}
