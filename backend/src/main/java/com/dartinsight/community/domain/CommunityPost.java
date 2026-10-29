package com.dartinsight.community.domain;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * 기업 게시판의 글(6.6 #460). 본문은 지우거나 가려도 남긴다(신고 처리에 씀).
 * 좋아요·댓글 수는 이 행을 잠근 채 고친다(CommunityPostRepository.findByIdForUpdate).
 */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "community_post")
public class CommunityPost implements CommunityContent {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "corp_code", nullable = false, length = 8)
    private String corpCode;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, length = CommunityText.MAX_POST)
    private String body;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 10)
    private ContentStatus status;

    /** 좋아요 수 */
    @Column(name = "like_count", nullable = false)
    private int likeCount;

    /** 지우지 않은 댓글·답글 수(가려진 것 포함) */
    @Column(name = "comment_count", nullable = false)
    private int commentCount;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "edited_at")
    private LocalDateTime editedAt;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    public static CommunityPost create(String corpCode, long userId, String validBody, LocalDateTime now) {
        CommunityPost post = new CommunityPost();
        post.corpCode = corpCode;
        post.userId = userId;
        post.body = validBody;
        post.status = ContentStatus.VISIBLE;
        post.createdAt = now;
        return post;
    }

    /** 지웠고 남은 댓글도 없어 목록·상세에서 빠진 글 */
    public boolean isGone() {
        return status == ContentStatus.DELETED && commentCount == 0;
    }

    public String shownBody(Long viewerId) {
        return status.shownBody(body, isOwnedBy(viewerId));
    }

    /** 인용은 보이는 글이면 누구에게나, 가렸거나 지운 글이면 작성자에게만 보인다(API 명세 Post.quote) */
    public boolean showsQuoteTo(Long viewerId) {
        return status == ContentStatus.VISIBLE || isOwnedBy(viewerId);
    }

    public void requireOwner(long viewerId) {
        if (!isOwnedBy(viewerId)) throw new ApiException(ErrorCode.COMMUNITY_FORBIDDEN);
    }

    /** 댓글·좋아요·고치기는 보이는 글에만 */
    public void requireVisible() {
        if (status != ContentStatus.VISIBLE) throw new ApiException(ErrorCode.COMMUNITY_TARGET_UNAVAILABLE);
    }

    public void edit(String validBody, LocalDateTime now) {
        requireVisible();
        body = validBody;
        editedAt = now;
    }

    /** 이미 지웠으면 그대로 둔다. 가린 글도 작성자가 지울 수 있다 */
    public void delete(LocalDateTime now) {
        moderate(ModerationDecision.DELETE, now);
    }

    @Override
    public TargetType targetType() {
        return TargetType.POST;
    }

    @Override
    public Long boardPostId() {
        return id;
    }

    @Override
    public boolean moderate(ModerationDecision decision, LocalDateTime now) {
        ContentStatus next = status.moderated(decision);
        boolean deleted = next == ContentStatus.DELETED && status != ContentStatus.DELETED;
        if (deleted) deletedAt = now;
        status = next;
        return deleted;
    }

    public void addComment() {
        commentCount++;
    }

    public void removeComment() {
        if (commentCount > 0) commentCount--;
    }

    public void addLike() {
        likeCount++;
    }

    public void removeLike() {
        if (likeCount > 0) likeCount--;
    }
}
