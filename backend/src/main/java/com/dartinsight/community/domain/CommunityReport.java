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
 * 신고된 글·댓글 한 건(6.6 #461). 대상마다 한 행이고, 회원별 신고는 CommunityReportEntry에 쌓는다.
 * 신고만으로 대상을 가리지 않고 관리자가 처리할 때만 상태가 바뀐다.
 */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "community_report")
public class CommunityReport {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "target_type", nullable = false, length = 10)
    private TargetType targetType;

    @Column(name = "target_id", nullable = false)
    private Long targetId;

    /** 대상이 속한 글 */
    @Column(name = "post_id", nullable = false)
    private Long postId;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 10)
    private ReportStatus status;

    /** 지금까지 신고한 회원 수 */
    @Column(name = "report_count", nullable = false)
    private int reportCount;

    /** 블라인드 기한. BLINDED일 때만 */
    @Column(name = "blind_until")
    private LocalDateTime blindUntil;

    @Column(name = "last_reported_at", nullable = false)
    private LocalDateTime lastReportedAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    /** 처음 신고된 대상. 신고 수는 addReport로 더한다 */
    public static CommunityReport open(CommunityContent target, LocalDateTime now) {
        CommunityReport report = new CommunityReport();
        report.targetType = target.targetType();
        report.targetId = target.getId();
        report.postId = target.boardPostId();
        report.status = ReportStatus.OPEN;
        report.lastReportedAt = now;
        report.createdAt = now;
        report.updatedAt = now;
        return report;
    }

    /** 회원 한 명의 신고를 센다. 유지로 처리된 뒤 새 신고가 오면 다시 처리 대기다 */
    public void addReport(LocalDateTime now) {
        reportCount++;
        lastReportedAt = now;
        if (status == ReportStatus.KEPT) {
            status = ReportStatus.OPEN;
            updatedAt = now;
        }
    }

    /** 관리자 처리. 삭제로 처리한 신고는 다시 처리하지 않는다(409) */
    public void moderate(CommunityModeration moderation) {
        if (status == ReportStatus.DELETED) throw new ApiException(ErrorCode.COMMUNITY_REPORT_CLOSED);
        status = moderation.getDecision().reportStatus();
        blindUntil = moderation.getBlindUntil();
        updatedAt = moderation.getCreatedAt();
    }

    /** 가린 채 기한이 지났는지. 지나도 자동으로 풀지 않는다 */
    public boolean isExpired(LocalDateTime now) {
        return status == ReportStatus.BLINDED && blindUntil != null && !now.isBefore(blindUntil);
    }
}
