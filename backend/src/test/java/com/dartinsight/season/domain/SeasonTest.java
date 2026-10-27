package com.dartinsight.season.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.dartinsight.report.domain.ReportType;
import java.time.LocalDate;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class SeasonTest {

    @Test
    @DisplayName("제출 기한(분기·반기 45일, 사업보고서 90일)에서 7일이 지난 가장 최근 시즌을 고른다")
    void picksLatestSeasonPastDeadlineAndGrace() {
        // 2026 반기: 6/30 + 45일 = 8/14, + 7일 = 8/21
        assertThat(Season.latestDue(LocalDate.of(2026, 10, 27), 7)).contains(new Season(ReportType.HALF, 2026));
        assertThat(Season.latestDue(LocalDate.of(2026, 8, 21), 7)).contains(new Season(ReportType.HALF, 2026));
        assertThat(Season.latestDue(LocalDate.of(2026, 8, 20), 7)).contains(new Season(ReportType.Q1, 2026));
        // 2025 사업보고서: 12/31 + 90일 = 3/31, + 7일 = 4/7. 그 사이 2025 3분기(11/21)보다 최근 기간이다
        assertThat(Season.latestDue(LocalDate.of(2026, 4, 7), 7)).contains(new Season(ReportType.ANNUAL, 2025));
        assertThat(Season.latestDue(LocalDate.of(2026, 4, 6), 7)).contains(new Season(ReportType.Q3, 2025));
    }

    @Test
    @DisplayName("시즌의 기간 끝과 제출 기한을 계산한다")
    void periodEndAndDeadline() {
        assertThat(new Season(ReportType.Q3, 2026).periodEnd()).isEqualTo(LocalDate.of(2026, 9, 30));
        assertThat(new Season(ReportType.Q3, 2026).deadline()).isEqualTo(LocalDate.of(2026, 11, 14));
        assertThat(new Season(ReportType.ANNUAL, 2025).deadline()).isEqualTo(LocalDate.of(2026, 3, 31));
    }
}
