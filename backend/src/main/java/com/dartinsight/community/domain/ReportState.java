package com.dartinsight.community.domain;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Stream;

/**
 * 신고 건과 그 처리 기록·재게시 청구. 관리자 목록의 '처리할 이유'와 작성자의 블라인드 안내를 여기서 정한다.
 *
 * @param moderations 처리 기록, 최근 순
 * @param repostRequest 마지막 블라인드 처리에 대한 재게시 청구. 없으면 null
 */
public record ReportState(CommunityReport report, List<CommunityModeration> moderations,
        CommunityRepostRequest repostRequest) {

    public ReportState {
        moderations = List.copyOf(moderations);
    }

    /** 마지막 처리. 처리하지 않았으면 비었다 */
    public Optional<CommunityModeration> lastModeration() {
        return moderations.stream().findFirst();
    }

    /** 지금 블라인드 처리. 블라인드 상태가 아니면 409(재게시 청구 불가) */
    public CommunityModeration currentBlind() {
        return lastModeration()
                .filter(moderation -> report.getStatus() == ReportStatus.BLINDED && moderation.isBlind())
                .orElseThrow(() -> new ApiException(ErrorCode.COMMUNITY_REPOST_NOT_ALLOWED));
    }

    /** 지금 블라인드에 재게시를 청구했는지 */
    public boolean repostRequested() {
        return report.getStatus() == ReportStatus.BLINDED && repostRequest != null;
    }

    /** 처리할 이유. 재게시 청구가 기한 지남보다 먼저다(작성자가 기다리는 쪽). 처리할 것이 없으면 null */
    public ReportTodo todo(LocalDateTime now) {
        if (report.getStatus() == ReportStatus.OPEN) return ReportTodo.PENDING;
        if (repostRequested()) return ReportTodo.REPOST_REQUESTED;
        if (report.isExpired(now)) return ReportTodo.EXPIRED;
        return null;
    }

    /** 관리자의 '처리할 것': 처리할 이유가 있는 것만, 마지막 신고·청구·지난 기한 중 가장 최근 순(같으면 신고 건 ID 역순) */
    public static List<ReportState> todoQueue(List<ReportState> states, LocalDateTime now) {
        return states.stream()
                .filter(state -> state.todo(now) != null)
                .sorted(Comparator.comparing((ReportState state) -> state.todoAt(now))
                        .thenComparing(state -> state.report().getId())
                        .reversed())
                .toList();
    }

    /** '처리할 것' 정렬 기준: 마지막 신고·청구 시각·지난 기한 중 가장 최근 */
    public LocalDateTime todoAt(LocalDateTime now) {
        return Stream.of(report.getLastReportedAt(),
                        repostRequested() ? repostRequest.getCreatedAt() : null,
                        report.isExpired(now) ? report.getBlindUntil() : null)
                .filter(Objects::nonNull)
                .max(LocalDateTime::compareTo)
                .orElseThrow();
    }
}
