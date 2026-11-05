package com.dartinsight.llmquota.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class DailyQuotaCounterTest {

    private static final LocalDate DAY = LocalDate.of(2026, 11, 5);

    @Test
    @DisplayName("호출자 한도를 넘으면 그 호출자만 막고, 넘은 요청은 세지 않는다")
    void blocksOnlyTheCallerOverLimit() {
        DailyQuotaCounter counter = new DailyQuotaCounter();
        assertThat(counter.acquire("a", 2, 10, DAY)).isEqualTo(QuotaDecision.ALLOWED);
        assertThat(counter.acquire("a", 2, 10, DAY)).isEqualTo(QuotaDecision.ALLOWED);
        assertThat(counter.acquire("a", 2, 10, DAY)).isEqualTo(QuotaDecision.CALLER_EXCEEDED);
        assertThat(counter.acquire("b", 2, 10, DAY)).isEqualTo(QuotaDecision.ALLOWED);
    }

    @Test
    @DisplayName("전체 한도가 호출자 한도보다 먼저다")
    void checksTotalFirst() {
        DailyQuotaCounter counter = new DailyQuotaCounter();
        assertThat(counter.acquire("a", 5, 2, DAY)).isEqualTo(QuotaDecision.ALLOWED);
        assertThat(counter.acquire("b", 5, 2, DAY)).isEqualTo(QuotaDecision.ALLOWED);
        assertThat(counter.acquire("c", 5, 2, DAY)).isEqualTo(QuotaDecision.TOTAL_EXCEEDED);
    }

    @Test
    @DisplayName("날짜가 바뀌면 모두 0부터 다시 센다")
    void resetsOnNewDay() {
        DailyQuotaCounter counter = new DailyQuotaCounter();
        counter.acquire("a", 1, 1, DAY);
        assertThat(counter.acquire("a", 1, 1, DAY)).isEqualTo(QuotaDecision.TOTAL_EXCEEDED);
        assertThat(counter.acquire("a", 1, 1, DAY.plusDays(1))).isEqualTo(QuotaDecision.ALLOWED);
    }

    @Test
    @DisplayName("전체 한도 초과 알림은 하루에 한 번만 처음이고, 날짜가 바뀌면 다시 처음이다")
    void reportsTotalExceededOncePerDay() {
        DailyQuotaCounter counter = new DailyQuotaCounter();
        counter.acquire("a", 1, 1, DAY);
        assertThat(counter.acquire("b", 1, 1, DAY)).isEqualTo(QuotaDecision.TOTAL_EXCEEDED);
        assertThat(counter.firstTotalExceededToday()).isTrue();
        assertThat(counter.firstTotalExceededToday()).isFalse();
        counter.acquire("a", 1, 1, DAY.plusDays(1));
        assertThat(counter.firstTotalExceededToday()).isTrue();
    }
}
