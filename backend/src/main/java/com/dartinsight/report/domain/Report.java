package com.dartinsight.report.domain;

import com.dartinsight.report.domain.ReportNameParser.ParsedReportName;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Objects;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * 정기보고서. 기본키는 자동 증가 id이고, 보고서는 접수번호(rcept_no, UNIQUE)로 가리킨다(docs/erd.md, ADR-0017).
 * lastSeenAt은 OpenDART 최신 목록에서 마지막으로 본 시각이다. 정정되어 최신 목록에서 빠진 보고서는
 * 지우지 않고(이미 분석에 쓰였을 수 있음) 목록에만 보이지 않게 한다.
 */
@Entity
@Table(name = "report")
public class Report {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "rcept_no", nullable = false, unique = true, length = 14)
    private String rceptNo;

    @Column(name = "corp_code", nullable = false, length = 8)
    private String corpCode;

    @Column(name = "report_name", nullable = false, length = 200)
    private String reportName;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "report_type", nullable = false, length = 10)
    private ReportType reportType;

    @Column(name = "fiscal_year", nullable = false)
    private int fiscalYear;

    @Column(name = "period_end", nullable = false)
    private LocalDate periodEnd;

    @Column(name = "rcept_dt", nullable = false)
    private LocalDate rceptDt;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "correction", nullable = false, length = 10)
    private Correction correction;

    @Column(name = "remark", length = 20)
    private String remark;

    @Column(name = "filer_name", length = 200)
    private String filerName;

    @Column(name = "last_seen_at", nullable = false)
    private LocalDateTime lastSeenAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    protected Report() {
    }

    public static Report create(String rceptNo, String corpCode, String reportName, ParsedReportName parsed,
            LocalDate rceptDt, String remark, String filerName, LocalDateTime now) {
        Report report = new Report();
        report.rceptNo = rceptNo;
        report.corpCode = corpCode;
        report.createdAt = now;
        report.apply(reportName, parsed, rceptDt, remark, filerName, now);
        return report;
    }

    /** 최신 목록에서 다시 봤을 때. 바뀐 값이 있으면 true. */
    public boolean refresh(String reportName, ParsedReportName parsed, LocalDate rceptDt, String remark,
            String filerName, LocalDateTime now) {
        boolean changed = !Objects.equals(this.reportName, reportName)
                || this.correction != parsed.correction()
                || !Objects.equals(this.rceptDt, rceptDt)
                || !Objects.equals(this.remark, remark)
                || !Objects.equals(this.filerName, filerName);
        apply(reportName, parsed, rceptDt, remark, filerName, now);
        return changed;
    }

    private void apply(String reportName, ParsedReportName parsed, LocalDate rceptDt, String remark,
            String filerName, LocalDateTime now) {
        this.reportName = reportName;
        this.reportType = parsed.type();
        this.fiscalYear = parsed.fiscalYear();
        this.periodEnd = parsed.periodEnd();
        this.rceptDt = rceptDt;
        this.correction = parsed.correction();
        this.remark = remark;
        this.filerName = filerName;
        this.lastSeenAt = now;
        this.updatedAt = now;
    }

    public Long getId() {
        return id;
    }

    public String getRceptNo() {
        return rceptNo;
    }

    public String getCorpCode() {
        return corpCode;
    }

    public String getReportName() {
        return reportName;
    }

    public ReportType getReportType() {
        return reportType;
    }

    public int getFiscalYear() {
        return fiscalYear;
    }

    public LocalDate getPeriodEnd() {
        return periodEnd;
    }

    public LocalDate getRceptDt() {
        return rceptDt;
    }

    public Correction getCorrection() {
        return correction;
    }

    public String getRemark() {
        return remark;
    }

    public String getFilerName() {
        return filerName;
    }

    public LocalDateTime getLastSeenAt() {
        return lastSeenAt;
    }
}
