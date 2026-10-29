package com.dartinsight.community.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 블라인드 처리 하나에 대한 작성자의 재게시 청구(6.6 #461). 블라인드마다 한 번(UNIQUE moderation_id). */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "community_repost_request")
public class CommunityRepostRequest {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "moderation_id", nullable = false)
    private Long moderationId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** 작성자가 남긴 말. 없으면 null */
    @Column(length = CommunityText.MAX_REPOST_MESSAGE)
    private String message;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    public static CommunityRepostRequest create(CommunityModeration blind, long userId, String validMessage,
            LocalDateTime now) {
        CommunityRepostRequest request = new CommunityRepostRequest();
        request.moderationId = blind.getId();
        request.userId = userId;
        request.message = validMessage;
        request.createdAt = now;
        return request;
    }
}
