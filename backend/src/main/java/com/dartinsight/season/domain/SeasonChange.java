package com.dartinsight.season.domain;

import com.dartinsight.report.domain.ReportType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/** 시즌 하나의 대표 기업 한 곳(1.7, #420, ADR-0037). 점수를 매기지 못했으면 사유(status)만 있다 */
@Entity
@Table(name = "season_change")
public class SeasonChange {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "report_type", nullable = false, length = 10)
    private ReportType reportType;

    @Column(name = "fiscal_year", nullable = false)
    private int fiscalYear;

    @Column(name = "corp_code", nullable = false, length = 8)
    private String corpCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private SeasonChangeStatus status;

    @Column(name = "previous_rcept_no", length = 14)
    private String previousRceptNo;

    @Column(name = "current_rcept_no", length = 14)
    private String currentRceptNo;

    @Column(name = "score", precision = 12, scale = 2)
    private BigDecimal score;

    @Column(name = "change_count")
    private Integer changeCount;

    @Column(name = "highlight", length = 300)
    private String highlight;

    @Column(name = "rank_no")
    private Integer rankNo;

    @Column(name = "analysis_id")
    private Long analysisId;

    @Column(name = "reason", length = 500)
    private String reason;

    @Column(name = "score_version", nullable = false, length = 20)
    private String scoreVersion;

    @Column(name = "candidate_count", nullable = false)
    private int candidateCount;

    @Column(name = "computed_at", nullable = false)
    private LocalDateTime computedAt;

    protected SeasonChange() {}

    private static SeasonChange of(Season season, String corpCode, SeasonChangeStatus status, int candidateCount,
            LocalDateTime now) {
        SeasonChange change = new SeasonChange();
        change.reportType = season.reportType();
        change.fiscalYear = season.fiscalYear();
        change.corpCode = corpCode;
        change.status = status;
        change.scoreVersion = SeasonScore.VERSION;
        change.candidateCount = candidateCount;
        change.computedAt = now;
        return change;
    }

    public static SeasonChange scored(Season season, String corpCode, String previousRceptNo, String currentRceptNo,
            SeasonScore score, int candidateCount, LocalDateTime now) {
        SeasonChange change = of(season, corpCode, SeasonChangeStatus.SCORED, candidateCount, now);
        change.previousRceptNo = previousRceptNo;
        change.currentRceptNo = currentRceptNo;
        change.score = score.score();
        change.changeCount = score.changeCount();
        change.highlight = score.highlight();
        return change;
    }

    public static SeasonChange noReport(Season season, String corpCode, int candidateCount, LocalDateTime now) {
        return of(season, corpCode, SeasonChangeStatus.NO_REPORT, candidateCount, now);
    }

    public static SeasonChange failed(Season season, String corpCode, String previousRceptNo, String currentRceptNo,
            String reason, int candidateCount, LocalDateTime now) {
        SeasonChange change = of(season, corpCode, SeasonChangeStatus.FAILED, candidateCount, now);
        change.previousRceptNo = previousRceptNo;
        change.currentRceptNo = currentRceptNo;
        change.reason = reason == null || reason.length() <= 500 ? reason : reason.substring(0, 500);
        return change;
    }

    public void rank(int rankNo) {
        this.rankNo = rankNo;
    }

    public void linkAnalysis(long analysisId) {
        this.analysisId = analysisId;
    }

    public Long getId() { return id; }

    public ReportType getReportType() { return reportType; }

    public int getFiscalYear() { return fiscalYear; }

    public String getCorpCode() { return corpCode; }

    public SeasonChangeStatus getStatus() { return status; }

    public String getPreviousRceptNo() { return previousRceptNo; }

    public String getCurrentRceptNo() { return currentRceptNo; }

    public BigDecimal getScore() { return score; }

    public Integer getChangeCount() { return changeCount; }

    public String getHighlight() { return highlight; }

    public Integer getRankNo() { return rankNo; }

    public Long getAnalysisId() { return analysisId; }

    public int getCandidateCount() { return candidateCount; }

    public LocalDateTime getComputedAt() { return computedAt; }
}
