package com.dartinsight.analysis.domain;

import com.dartinsight.comparison.domain.ComparisonBasis;
import com.dartinsight.financial.domain.FsDiv;
import com.dartinsight.summary.domain.SummaryStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.LocalDateTime;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * 분석 작업(docs/erd.md). 기업·현재 보고서·이전 보고서·비교 기준·분석 버전으로 결과를 식별한다.
 */
@Entity
@Table(name = "analysis")
public class Analysis {

    /**
     * 분석 결과 버전. 결과가 달라지는 규칙이 바뀌면 올려서 옛 결과를 다시 쓰지 않는다:
     * 재무 비교·계산, 원문 파서(PARSER_VERSION), 문장 비교(DIFF_VERSION), 우선순위(priority-n),
     * 요약 프롬프트(PROMPT_VERSION), 표현 검사 규칙(RULESET_VERSION), 설명 후보 검색어(AccountAliases),
     * 재무 설명 등급 규칙(GRADE_RULES_VERSION).
     */
    public static final String CURRENT_VERSION = "m2-9";

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

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "text_status", length = 20)
    private TextStatus textStatus;

    @Column(name = "text_message", length = 500)
    private String textMessage;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "summary_status", length = 20)
    private SummaryStatus summaryStatus;

    @Column(name = "summary_message", length = 500)
    private String summaryMessage;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    /** 실행 중인 분석과 만료 처리가 서로의 상태를 덮어쓰지 않도록 낙관적 잠금 */
    @Version
    @Column(name = "version", nullable = false)
    private Long version;

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

    /** 문장 비교 결과 상태. 결과를 저장하는 트랜잭션에서 완료와 함께 남긴다. */
    public void recordText(TextStatus status, String message) {
        this.textStatus = status;
        this.textMessage = message == null || message.length() <= 500 ? message : message.substring(0, 500);
    }

    /** 요약 상태. 결과를 저장하는 트랜잭션에서 완료와 함께 남긴다. */
    public void recordSummary(SummaryStatus status, String message) {
        this.summaryStatus = status;
        this.summaryMessage = message == null || message.length() <= 500 ? message : message.substring(0, 500);
    }

    /** 결과를 저장한 같은 트랜잭션 안에서만 부른다(RUNNING → COMPLETED). */
    public void complete(LocalDateTime now) {
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

    /** 문장 비교 상태. M1 분석이나 완료 전이면 null */
    public TextStatus getTextStatus() {
        return textStatus;
    }

    public String getTextMessage() {
        return textMessage;
    }

    /** 요약 상태. 완료 전이면 null */
    public SummaryStatus getSummaryStatus() {
        return summaryStatus;
    }

    public String getSummaryMessage() {
        return summaryMessage;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    /** 상태나 단계가 마지막으로 바뀐 시각 */
    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public LocalDateTime getStartedAt() {
        return startedAt;
    }

    public LocalDateTime getCompletedAt() {
        return completedAt;
    }
}
