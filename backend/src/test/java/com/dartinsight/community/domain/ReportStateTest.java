package com.dartinsight.community.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** 관리자 목록의 '처리할 이유'와 정렬 기준(6.6 #461). 현재 시각은 Clock에서 얻은 값을 그대로 넣는다. */
class ReportStateTest {
    private static final LocalDateTime REPORTED = LocalDateTime.of(2026, 10, 27, 10, 0);
    private static final LocalDateTime BLINDED = REPORTED.plusHours(1);

    @Test
    @DisplayName("처리 전 신고는 '대기'이고 기준 시각은 마지막 신고다")
    void openReportIsPending() {
        ReportState state = new ReportState(reported(), List.of(), null);

        assertThat(state.todo(REPORTED.plusDays(100))).isEqualTo(ReportTodo.PENDING);
        assertThat(state.todoAt(REPORTED.plusDays(100))).isEqualTo(REPORTED);
    }

    @Test
    @DisplayName("블라인드는 기한 전에는 처리할 것이 없고, 기한 시각부터 '기한 지남'이며 기준 시각은 기한이다")
    void blindExpiresAtDeadline() {
        CommunityReport report = reported();
        CommunityModeration blind = blind(report, 7);
        LocalDateTime until = BLINDED.plusDays(7);
        ReportState state = new ReportState(report, List.of(blind), null);

        assertThat(state.todo(until.minusSeconds(1))).isNull();
        assertThat(state.todo(until)).isEqualTo(ReportTodo.EXPIRED);
        assertThat(state.todoAt(until.plusDays(3))).isEqualTo(until);
        assertThat(report.getStatus()).isEqualTo(ReportStatus.BLINDED);
    }

    @Test
    @DisplayName("재게시 청구가 있으면 기한이 지났어도 '재게시 청구'이고, 기준 시각은 청구·기한 중 늦은 쪽이다")
    void repostRequestWinsOverExpiry() {
        CommunityReport report = reported();
        CommunityModeration blind = blind(report, 1);
        LocalDateTime requested = BLINDED.plusDays(3);
        ReportState state = new ReportState(report, List.of(blind),
                CommunityRepostRequest.create(blind, 1L, null, requested));

        assertThat(state.todo(BLINDED.plusHours(2))).isEqualTo(ReportTodo.REPOST_REQUESTED);
        assertThat(state.todo(BLINDED.plusDays(10))).isEqualTo(ReportTodo.REPOST_REQUESTED);
        assertThat(state.todoAt(BLINDED.plusDays(10))).isEqualTo(requested);
    }

    @Test
    @DisplayName("유지하면 처리할 것이 없고, 블라인드 기한도 지운다")
    void keptReportHasNothingToDo() {
        CommunityReport report = reported();
        blind(report, 1);
        report.moderate(CommunityModeration.record(report, 9L,
                ModerationCommand.of("KEEP", "의견 표현", null), BLINDED.plusHours(1)));
        ReportState state = new ReportState(report, List.of(), null);

        assertThat(state.todo(BLINDED.plusDays(10))).isNull();
        assertThat(report.getBlindUntil()).isNull();
    }

    private static CommunityReport reported() {
        CommunityReport report = CommunityReport.open(CommunityPost.create("00000001", 1L, "본문", REPORTED),
                REPORTED);
        report.addReport(REPORTED);
        return report;
    }

    private static CommunityModeration blind(CommunityReport report, int days) {
        CommunityModeration blind = CommunityModeration.record(report, 9L,
                ModerationCommand.of("BLIND", "사유", days), BLINDED);
        report.moderate(blind);
        return blind;
    }
}
