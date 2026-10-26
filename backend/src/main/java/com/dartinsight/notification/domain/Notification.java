package com.dartinsight.notification.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

/** 회원 한 명에게 남긴 분석 완료 알림(6.4, #38). 회원과 분석 쌍은 한 번만 있다. */
@Entity
@Table(name = "notification")
public class Notification {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "analysis_id", nullable = false)
    private Long analysisId;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "read_at")
    private LocalDateTime readAt;

    protected Notification() {}

    public static Notification create(long userId, long analysisId, LocalDateTime now) {
        Notification notification = new Notification();
        notification.userId = userId;
        notification.analysisId = analysisId;
        notification.createdAt = now;
        return notification;
    }

    /** 이미 읽었으면 처음 읽은 시각을 둔다 */
    public void markRead(LocalDateTime now) {
        if (readAt == null) {
            readAt = now;
        }
    }

    public void markUnread() {
        readAt = null;
    }

    public Long getId() { return id; }

    public Long getAnalysisId() { return analysisId; }

    public LocalDateTime getCreatedAt() { return createdAt; }

    public LocalDateTime getReadAt() { return readAt; }
}
