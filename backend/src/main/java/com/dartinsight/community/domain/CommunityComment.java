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

/** 글의 댓글·답글(6.6 #460). 답글은 한 단계만이라 부모는 답글이 아닌 댓글이다. */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "community_comment")
public class CommunityComment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "post_id", nullable = false)
    private Long postId;

    /** 답글이면 부모 댓글 ID */
    @Column(name = "parent_id")
    private Long parentId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, length = CommunityText.MAX_COMMENT)
    private String body;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 10)
    private ContentStatus status;

    @Column(name = "like_count", nullable = false)
    private int likeCount;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "edited_at")
    private LocalDateTime editedAt;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    /** parent가 있으면 그 댓글의 답글. 부모는 같은 글의 답글이 아닌 댓글이어야 하고(아니면 400 parentId), 보여야 한다(아니면 409) */
    public static CommunityComment create(CommunityPost post, CommunityComment parent, long userId,
            String validBody, LocalDateTime now) {
        if (parent != null && (!parent.postId.equals(post.getId()) || parent.isReply())) {
            throw ApiException.invalidInput("parentId", "이 글의 댓글에만 답글을 달 수 있습니다(답글은 한 단계).");
        }
        if (parent != null) parent.requireVisible();
        CommunityComment comment = new CommunityComment();
        comment.postId = post.getId();
        comment.parentId = parent == null ? null : parent.id;
        comment.userId = userId;
        comment.body = validBody;
        comment.status = ContentStatus.VISIBLE;
        comment.createdAt = now;
        return comment;
    }

    public boolean isReply() {
        return parentId != null;
    }

    public boolean isDeleted() {
        return status == ContentStatus.DELETED;
    }

    public boolean isOwnedBy(Long viewerId) {
        return userId.equals(viewerId);
    }

    public String shownBody(Long viewerId) {
        return status.shownBody(body, isOwnedBy(viewerId));
    }

    public void requireOwner(long viewerId) {
        if (!isOwnedBy(viewerId)) throw new ApiException(ErrorCode.COMMUNITY_FORBIDDEN);
    }

    public void requireVisible() {
        if (status != ContentStatus.VISIBLE) throw new ApiException(ErrorCode.COMMUNITY_TARGET_UNAVAILABLE);
    }

    public void edit(String validBody, LocalDateTime now) {
        requireVisible();
        body = validBody;
        editedAt = now;
    }

    /** 지웠으면 true. 이미 지운 댓글이면 false(글의 댓글 수를 다시 빼지 않게) */
    public boolean delete(LocalDateTime now) {
        if (isDeleted()) return false;
        status = ContentStatus.DELETED;
        deletedAt = now;
        return true;
    }

    public void addLike() {
        likeCount++;
    }

    public void removeLike() {
        if (likeCount > 0) likeCount--;
    }
}
