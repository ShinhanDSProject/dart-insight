package com.dartinsight.textevent.domain;

import java.time.LocalDateTime;

/**
 * 현재 사건 버전의 작업 상태. 실행 행이 없을 때의 상태까지 담는다.
 *
 * @param runId  실행 행 id. 없으면 null
 * @param status {@link TextEventRunStatus} 이름 또는 {@link #NOT_STARTED}
 */
public record TextEventRunView(long analysisId, Long runId, String status, NotCreatedReason notCreatedReason,
        String errorCode, boolean canRetry, int droppedEventCount, String signalTableVersion,
        LocalDateTime startedAt, LocalDateTime finishedAt) {

    public static final String NOT_STARTED = "NOT_STARTED";

    /** 실행 행이 없는 상태 */
    public static TextEventRunView notStarted(long analysisId) {
        return new TextEventRunView(analysisId, null, NOT_STARTED, null, null, false, 0, null, null, null);
    }

    /** 저장하지 않고 조회할 때 정한 '만들지 않음' */
    public static TextEventRunView notCreated(long analysisId, NotCreatedReason reason) {
        return new TextEventRunView(analysisId, null, TextEventRunStatus.NOT_CREATED.name(), reason, null, false, 0,
                null, null, null);
    }

    /** 실행 행의 상태. 시각은 끝난 실행일 때만 준다(docs/api-spec.md) */
    public static TextEventRunView of(TextEventRun run, boolean canRetry) {
        return new TextEventRunView(run.getAnalysisId(), run.getId(), run.getStatus().name(),
                run.getNotCreatedReason(), run.getErrorCode(), canRetry, run.getDroppedEventCount(),
                run.getSignalTableVersion(), run.finished() ? run.getStartedAt() : null, run.finished() ? run.getFinishedAt() : null);
    }

    public boolean is(TextEventRunStatus expected) {
        return expected.name().equals(status);
    }
}
