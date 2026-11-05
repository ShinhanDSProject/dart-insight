package com.dartinsight.textevent.dto;

import com.dartinsight.textevent.domain.NotCreatedReason;
import com.dartinsight.textevent.domain.TextEventRunView;
import com.dartinsight.textevent.domain.TextEvents;
import java.time.LocalDateTime;

/** 주요 사건 작업 상태. */
public record TextEventRunResponse(long analysisId, String status, String eventVersion,
        NotCreatedReason notCreatedReason, String errorCode, boolean canRetry, LocalDateTime startedAt,
        LocalDateTime finishedAt) {

    public static TextEventRunResponse from(TextEventRunView view) {
        return new TextEventRunResponse(view.analysisId(), view.status(), TextEvents.EVENT_VERSION,
                view.notCreatedReason(), view.errorCode(), view.canRetry(), view.startedAt(), view.finishedAt());
    }
}
