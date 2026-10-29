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

/**
 * 관리자 처리 기록 한 줄(6.6 #461). 정보통신망법 제44조의2 임시조치의 기록이라 처리할 때마다 더하고 고치거나 지우지 않는다.
 */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "community_moderation")
public class CommunityModeration {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "report_id", nullable = false)
    private Long reportId;

    @Column(name = "admin_id", nullable = false)
    private Long adminId;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 10)
    private ModerationDecision decision;

    /** 처리 사유. 블라인드면 작성자에게 보인다 */
    @Column(nullable = false, length = CommunityText.MAX_MODERATION_REASON)
    private String reason;

    @Column(name = "blind_days")
    private Integer blindDays;

    @Column(name = "blind_until")
    private LocalDateTime blindUntil;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    /** 블라인드 기한은 처리 시각 + blindDays일 */
    public static CommunityModeration record(CommunityReport report, long adminId, ModerationCommand command,
            LocalDateTime now) {
        CommunityModeration moderation = new CommunityModeration();
        moderation.reportId = report.getId();
        moderation.adminId = adminId;
        moderation.decision = command.decision();
        moderation.reason = command.reason();
        moderation.blindDays = command.blindDays();
        moderation.blindUntil = command.blindDays() == null ? null : now.plusDays(command.blindDays());
        moderation.createdAt = now;
        return moderation;
    }

    public boolean isBlind() {
        return decision == ModerationDecision.BLIND;
    }
}
