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

/** 회원 한 명의 신고 한 번(6.6 #461). 같은 대상에 한 번만(UNIQUE). 신고한 사람은 어떤 응답에도 나가지 않는다. */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "community_report_entry")
public class CommunityReportEntry {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "report_id", nullable = false)
    private Long reportId;

    @Column(name = "reporter_id", nullable = false)
    private Long reporterId;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 20)
    private ReportReason reason;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    public static CommunityReportEntry create(CommunityReport report, long reporterId, ReportReason reason,
            LocalDateTime now) {
        CommunityReportEntry entry = new CommunityReportEntry();
        entry.reportId = report.getId();
        entry.reporterId = reporterId;
        entry.reason = reason;
        entry.createdAt = now;
        return entry;
    }
}
