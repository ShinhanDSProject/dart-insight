package com.dartinsight.textevent.domain;

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

/**
 * 분석 하나의 주요 사건 만들기 실행(ADR-0050). 분석 상태와 따로 움직인다. 결과를 저장하는 트랜잭션 안에서만 COMPLETED로 바꾼다.
 */
@Entity
@Table(name = "text_event_run")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class TextEventRun {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "analysis_id", nullable = false)
    private Long analysisId;

    @Column(name = "event_version", nullable = false, length = 20)
    private String eventVersion;

    @Column(name = "attempt_no", nullable = false)
    private int attemptNo;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private TextEventRunStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "not_created_reason", length = 30)
    private NotCreatedReason notCreatedReason;

    @Column(name = "error_code", length = 50)
    private String errorCode;

    @Column(name = "dropped_event_count", nullable = false)
    private int droppedEventCount;

    @Column(name = "trace_id", length = 64)
    private String traceId;

    /** 신호를 붙인 기준표 버전(ADR-0060). COMPLETED일 때만, event-3까지의 행은 null */
    @Column(name = "signal_table_version", length = 30)
    private String signalTableVersion;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "finished_at")
    private LocalDateTime finishedAt;

    public static TextEventRun create(Long analysisId, String eventVersion, int attemptNo, String traceId,
            LocalDateTime now) {
        TextEventRun run = new TextEventRun();
        run.analysisId = analysisId;
        run.eventVersion = eventVersion;
        run.attemptNo = attemptNo;
        run.status = TextEventRunStatus.PENDING;
        run.traceId = traceId;
        run.createdAt = now;
        return run;
    }

    public void start(LocalDateTime now) {
        moveTo(TextEventRunStatus.RUNNING);
        startedAt = now;
    }

    /** 결과를 저장하는 트랜잭션 안에서만 부른다 */
    public void complete(int droppedEventCount, String signalTableVersion, LocalDateTime now) {
        moveTo(TextEventRunStatus.COMPLETED);
        this.droppedEventCount = droppedEventCount;
        this.signalTableVersion = signalTableVersion;
        finishedAt = now;
    }

    public void notCreate(NotCreatedReason reason, LocalDateTime now) {
        moveTo(TextEventRunStatus.NOT_CREATED);
        notCreatedReason = reason;
        finishedAt = now;
    }

    public void fail(String errorCode, LocalDateTime now) {
        moveTo(TextEventRunStatus.FAILED);
        this.errorCode = errorCode;
        finishedAt = now;
    }

    public boolean finished() {
        return status.finished();
    }

    /** 다음 시작 때 새 실행을 만드는지. 실패와 fake 모델 때만 만든다 */
    public boolean startsAgain() {
        return status == TextEventRunStatus.FAILED || notCreatedReason == NotCreatedReason.FAKE_MODEL;
    }

    private void moveTo(TextEventRunStatus next) {
        if (!status.canMoveTo(next)) {
            throw new IllegalStateException("사건 실행 상태를 " + status + "에서 " + next + "로 바꿀 수 없습니다.");
        }
        status = next;
    }
}
