package com.dartinsight.system.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.dartinsight.common.error.ApiException;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class UsagePeriodTest {
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 4);

    @Test
    @DisplayName("오늘부터 거꾸로 days일이고, 날짜별 수는 기간의 모든 날짜를 오래된 순으로 0까지 채운다")
    void coversDaysEndingTodayAndFillsEmptyDates() {
        UsagePeriod period = UsagePeriod.endingOn(TODAY, 7);

        assertThat(period.from()).isEqualTo(LocalDate.of(2026, 10, 29));
        assertThat(period.start()).isEqualTo(LocalDate.of(2026, 10, 29).atStartOfDay());
        assertThat(period.end()).isEqualTo(LocalDate.of(2026, 11, 5).atStartOfDay());
        assertThat(period.dailyCounts(List.of(TODAY.atTime(9, 0), TODAY.atTime(23, 59),
                LocalDate.of(2026, 10, 29).atStartOfDay(), LocalDate.of(2026, 10, 28).atTime(23, 0))))
                .containsExactly(
                        Map.entry(LocalDate.of(2026, 10, 29), 1L),
                        Map.entry(LocalDate.of(2026, 10, 30), 0L),
                        Map.entry(LocalDate.of(2026, 10, 31), 0L),
                        Map.entry(LocalDate.of(2026, 11, 1), 0L),
                        Map.entry(LocalDate.of(2026, 11, 2), 0L),
                        Map.entry(LocalDate.of(2026, 11, 3), 0L),
                        Map.entry(TODAY, 2L));
    }

    @Test
    @DisplayName("7·30일이 아니면 400 errors[days]")
    void rejectsOtherDays() {
        assertThatThrownBy(() -> UsagePeriod.endingOn(TODAY, 14)).isInstanceOf(ApiException.class);
    }
}
