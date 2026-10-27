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
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * 분석 작업(docs/erd.md). 기업·현재 보고서·이전 보고서·비교 기준·분석 버전으로 결과를 식별한다.
 */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "analysis")
public class Analysis {

    /**
     * 분석 결과 버전. 결과가 달라지는 규칙이 바뀌면 올려서 옛 결과를 다시 쓰지 않는다:
     * 재무 비교·계산, 원문 파서(PARSER_VERSION), 문장 비교(DIFF_VERSION), 우선순위(priority-n),
     * 요약 프롬프트(PROMPT_VERSION), 표현 검사 규칙(RULESET_VERSION), 설명 후보 검색어(AccountAliases),
     * 재무 설명 등급 규칙(GRADE_RULES_VERSION), 요약에 저장하는 값(m2-10: 설명 등급·인용, #143),
     * m2-11: 원문 파서 dart-xml-2(표 안의 표·빈 표, #397).
     * m2-12: 계산 상태 판정(흑자·적자 전환과 이익 계정 목록 PROFIT_ACCOUNT_IDS, #144).
     * m2-13: 문장 우선순위 핵심어에 '계속기업' 추가(priority-3, #145).
     * m2-14: 재무 설명 후보를 ai-server가 보고서 문단 전체에서 BM25로 찾음(ADR-0036, #146).
     */
    public static final String CURRENT_VERSION = "m2-14";

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

    /** 문장 비교 상태. M1 분석이나 완료 전이면 null */
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "text_status", length = 20)
    private TextStatus textStatus;

    @Column(name = "text_message", length = 500)
    private String textMessage;

    /** 요약 상태. 완료 전이면 null */
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "summary_status", length = 20)
    private SummaryStatus summaryStatus;

    @Column(name = "summary_message", length = 500)
    private String summaryMessage;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    /** 상태나 단계가 마지막으로 바뀐 시각 */
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

    public boolean isCompleted() {
        return status == AnalysisStatus.COMPLETED;
    }

    /** 같은 조건의 요청에 다시 쓸 수 있는 완료 결과인지. 문장 비교가 실패로 끝났으면 다시 비교하도록 쓰지 않는다 */
    public boolean isReusableResult() {
        return isCompleted() && textStatus != TextStatus.FAILED;
    }

    /** 끝나지 않았는데 이 시각 전부터 상태가 바뀌지 않았는지(멈춘 분석) */
    public boolean stalledBefore(LocalDateTime staleBefore) {
        return !status.finished() && updatedAt.isBefore(staleBefore);
    }

    /** 문장 비교 결과가 있는지(비교하지 않았거나 실패했으면 false). 문장 변경 이력(3.8)에 이어 붙일 수 있다 */
    public boolean hasTextResult() {
        return textStatus != null && textStatus != TextStatus.FAILED;
    }

    private void moveTo(AnalysisStatus next, LocalDateTime now) {
        if (!status.canMoveTo(next)) {
            throw new IllegalStateException("분석 상태를 바꿀 수 없습니다: " + status + " → " + next);
        }
        status = next;
        updatedAt = now;
    }

    /** 지금 서버의 분석 방식(CURRENT_VERSION)과 다른 버전으로 만든 결과인지. */
    public boolean isOutdated() {
        return !CURRENT_VERSION.equals(analysisVersion);
    }
}
