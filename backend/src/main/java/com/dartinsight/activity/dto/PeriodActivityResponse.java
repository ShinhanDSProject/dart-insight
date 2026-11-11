package com.dartinsight.activity.dto;

import com.dartinsight.activity.domain.ActivityPayload;
import com.dartinsight.activity.domain.ActivityRecord;
import com.dartinsight.activity.domain.ActivityStatus;
import java.time.LocalDateTime;
import java.util.List;

/**
 * GET /api/analyses/{analysisId}/activities 응답(docs/api-spec.md, ADR-0067).
 *
 * @param reason  NOT_AVAILABLE일 때만 사유(TEXT_NOT_COMPARED)
 * @param message GENERATED가 아니면 안내
 */
public record PeriodActivityResponse(Long analysisId, ActivityStatus status, String reason, String message,
        ActivityPayload.Overview overview, List<ActivityPayload.Item> items,
        List<ActivityPayload.TimelineEntry> timeline, int droppedCount, int candidateCount, boolean aiGenerated,
        Ai ai) {

    public static final String TEXT_NOT_COMPARED = "TEXT_NOT_COMPARED";
    static final String EMPTY_MESSAGE = "두 보고서 사이에 눈여겨볼 활동을 찾지 못했어요. 전체 변경 탭에서 바뀐 문장을 모두 볼 수 있어요.";
    static final String NOT_COMPARED_MESSAGE = "이 분석은 문장을 비교하지 못해 활동을 정리할 수 없어요.";
    static final String REVIEW_MESSAGE = "AI가 만든 활동이 근거·표현 확인을 통과하지 못했어요.";

    public record Ai(String model, String promptVersion, LocalDateTime generatedAt) {
    }

    /** 저장한 결과 */
    public static PeriodActivityResponse of(ActivityRecord row) {
        ActivityPayload payload = row.payload();
        String message = switch (row.status()) {
            case GENERATED, NOT_AVAILABLE -> null;
            case EMPTY -> EMPTY_MESSAGE;
            case REVIEW_NEEDED -> row.reviewReason() == null ? REVIEW_MESSAGE : row.reviewReason();
        };
        return new PeriodActivityResponse(row.analysisId(), row.status(), null, message, payload.overview(),
                payload.items(), payload.timeline() == null ? List.of() : payload.timeline(), payload.droppedCount(),
                payload.candidateCount(), true,
                new Ai(row.model(), row.promptVersion(), row.generatedAt()));
    }

    /** AI를 부르지 않고 후보가 없어 끝난 결과(저장하지 않음) */
    public static PeriodActivityResponse noCandidates(Long analysisId) {
        return new PeriodActivityResponse(analysisId, ActivityStatus.EMPTY, null, EMPTY_MESSAGE, null, List.of(), List.of(),
                0, 0, false, null);
    }

    /** 문장 비교 결과가 없는 분석(저장하지 않음) */
    public static PeriodActivityResponse textNotCompared(Long analysisId) {
        return new PeriodActivityResponse(analysisId, ActivityStatus.NOT_AVAILABLE, TEXT_NOT_COMPARED,
                NOT_COMPARED_MESSAGE, null, List.of(), List.of(), 0, 0, false, null);
    }
}
