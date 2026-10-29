package com.dartinsight.community.domain;

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

/** 회원 한 명이 글·댓글 하나에 누른 좋아요. 같은 대상에 한 번만(uk_community_like_target_user). */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "community_like")
public class CommunityLike {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "target_type", nullable = false, length = 10)
    private LikeTarget targetType;

    @Column(name = "target_id", nullable = false)
    private Long targetId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    public static CommunityLike create(LikeTarget targetType, long targetId, long userId, LocalDateTime now) {
        CommunityLike like = new CommunityLike();
        like.targetType = targetType;
        like.targetId = targetId;
        like.userId = userId;
        like.createdAt = now;
        return like;
    }
}
