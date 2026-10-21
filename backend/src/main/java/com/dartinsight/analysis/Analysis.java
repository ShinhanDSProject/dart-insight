package com.dartinsight.analysis;

import com.dartinsight.comparison.ComparisonBasis;
import com.dartinsight.financial.FsDiv;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * 분석 작업(docs/erd.md). 기업·현재 보고서·이전 보고서·비교 기준·분석 버전으로 결과를 식별한다.
 */
@Entity
@Table(name = "analysis")
public class Analysis {

    /** 계산 규칙 버전. 비교 규칙이나 계산 방법이 바뀌면 올려서 옛 결과와 섞지 않는다. */
    public static final String CURRENT_VERSION = "m1-financial-1";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "corp_code", nullable = false, length = 8)
    private String corpCode;

    @Column(name = "current_rcept_no", nullable = false, length = 14)
    private String currentRceptNo;

    @Column(name = "previous_rcept_no", nullable = false, length = 14)
    private String previousRceptNo;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "basis", nullable = false, length = 10)
    private ComparisonBasis basis;

    @Column(name = "analysis_version", nullable = false, length = 20)
    private String analysisVersion;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "fs_div", length = 3)
    private FsDiv fsDiv;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "status", nullable = false, length = 10)
    private AnalysisStatus status;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "step", nullable = false, length = 20)
    private AnalysisStep step;

    @Column(name = "error_code", length = 50)
    private String errorCode;

    @Column(name = "error_message", length = 500)
    private String errorMessage;

    @Column(name = "request_trace_id", length = 64)
    private String requestTraceId;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    protected Analysis() {
    }

    public static Analysis request(String corpCode, String currentRceptNo, String previousRceptNo,
            ComparisonBasis basis, String requestTraceId, LocalDateTime now) {
        Analysis analysis = new Analysis();
        analysis.corpCode = corpCode;
        analysis.currentRceptNo = currentRceptNo;
        analysis.previousRceptNo = previousRceptNo;
        analysis.basis = basis;
        analysis.analysisVersion = CURRENT_VERSION;
        analysis.status = AnalysisStatus.PENDING;
        analysis.step = AnalysisStep.RECEIVED;
        analysis.requestTraceId = requestTraceId;
        analysis.createdAt = now;
        analysis.updatedAt = now;
        return analysis;
    }

    /** 실행을 시작한다(PENDING → RUNNING). */
    public void start(LocalDateTime now) {
        moveTo(AnalysisStatus.RUNNING, now);
        startedAt = now;
    }

    /** 다음 단계로 간다. 앞 단계로는 돌아가지 않는다. */
    public void advance(AnalysisStep next, LocalDateTime now) {
        if (status != AnalysisStatus.RUNNING || next.ordinal() <= step.ordinal() || next == AnalysisStep.DONE) {
            throw new IllegalStateException("단계를 바꿀 수 없습니다: " + status + " " + step + " → " + next);
        }
        step = next;
        updatedAt = now;
    }

    public void recordFsDiv(FsDiv fsDiv) {
        this.fsDiv = fsDiv;
    }

    /** 결과를 저장한 같은 트랜잭션 안에서만 부른다(RUNNING → COMPLETED). */
    void complete(LocalDateTime now) {
        moveTo(AnalysisStatus.COMPLETED, now);
        step = AnalysisStep.DONE;
        completedAt = now;
    }

    /** 실패로 끝낸다. 단계는 실패한 단계에 남긴다. */
    public void fail(String errorCode, String errorMessage, LocalDateTime now) {
        moveTo(AnalysisStatus.FAILED, now);
        this.errorCode = errorCode;
        this.errorMessage = errorMessage == null || errorMessage.length() <= 500 ? errorMessage
                : errorMessage.substring(0, 500);
        completedAt = now;
    }

    private void moveTo(AnalysisStatus next, LocalDateTime now) {
        if (!status.canMoveTo(next)) {
            throw new IllegalStateException("분석 상태를 바꿀 수 없습니다: " + status + " → " + next);
        }
        status = next;
        updatedAt = now;
    }

    public Long getId() {
        return id;
    }

    public String getCorpCode() {
        return corpCode;
    }

    public String getCurrentRceptNo() {
        return currentRceptNo;
    }

    public String getPreviousRceptNo() {
        return previousRceptNo;
    }

    public ComparisonBasis getBasis() {
        return basis;
    }

    public String getAnalysisVersion() {
        return analysisVersion;
    }

    public FsDiv getFsDiv() {
        return fsDiv;
    }

    public AnalysisStatus getStatus() {
        return status;
    }

    public AnalysisStep getStep() {
        return step;
    }

    public String getErrorCode() {
        return errorCode;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public String getRequestTraceId() {
        return requestTraceId;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getStartedAt() {
        return startedAt;
    }

    public LocalDateTime getCompletedAt() {
        return completedAt;
    }
}
