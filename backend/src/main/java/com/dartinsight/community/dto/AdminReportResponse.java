package com.dartinsight.community.dto;

import com.dartinsight.community.domain.CommunityReport;
import com.dartinsight.community.domain.ReportReason;
import com.dartinsight.community.domain.ReportState;
import com.dartinsight.community.domain.ReportStatus;
import com.dartinsight.community.domain.ReportTodo;
import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 관리자 신고 목록의 항목(API 명세 GET /api/admin/reports). 신고한 사람은 보이지 않고 사유별 건수만 준다.
 *
 * @param todo 처리할 이유. 처리할 것이 없으면 null
 * @param reasonCounts 네 사유 모두(신고가 없으면 0)
 * @param moderations 처리 기록, 최근 순
 */
public record AdminReportResponse(
        long reportId,
        ReportStatus status,
        ReportTodo todo,
        ReportTargetResponse target,
        int reportCount,
        Map<ReportReason, Long> reasonCounts,
        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss") LocalDateTime lastReportedAt,
        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss") LocalDateTime blindUntil,
        RepostResponse repostRequest,
        List<ModerationResponse> moderations) {

    /**
     * @param reasonCounts 신고가 있는 사유만 들어 있어도 된다
     * @param adminNicknames 관리자 ID → 닉네임
     */
    public static AdminReportResponse of(ReportState state, ReportTargetResponse target,
            Map<ReportReason, Long> reasonCounts, Map<Long, String> adminNicknames, LocalDateTime now) {
        CommunityReport report = state.report();
        Map<ReportReason, Long> counts = new LinkedHashMap<>();
        for (ReportReason reason : ReportReason.values()) counts.put(reason, reasonCounts.getOrDefault(reason, 0L));
        return new AdminReportResponse(report.getId(), report.getStatus(), state.todo(now), target,
                report.getReportCount(), counts, report.getLastReportedAt(), report.getBlindUntil(),
                RepostResponse.of(state.repostRequest()),
                state.moderations().stream()
                        .map(moderation -> ModerationResponse.of(moderation,
                                adminNicknames.get(moderation.getAdminId())))
                        .toList());
    }
}
