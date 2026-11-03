package com.dartinsight.news.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class CompanyNewsCacheTest {

    private static final LocalDateTime T0 = LocalDateTime.of(2026, 11, 3, 12, 0);

    @Test
    @DisplayName("받은 지 30분이 안 지난 뉴스만 주고, 넣을 때 30분이 지난 기업을 지운다")
    void servesFreshAndEvictsExpiredOnPut() {
        CompanyNewsCache cache = new CompanyNewsCache(Duration.ofMinutes(30));
        cache.put(news("A", T0), T0);
        cache.put(news("B", T0.plusMinutes(10)), T0.plusMinutes(10));

        assertThat(cache.fresh("A", T0.plusMinutes(29))).isPresent();
        assertThat(cache.fresh("A", T0.plusMinutes(30))).isEmpty();

        cache.put(news("C", T0.plusMinutes(35)), T0.plusMinutes(35));

        assertThat(cache.size()).isEqualTo(2);
        assertThat(cache.fresh("B", T0.plusMinutes(35))).isPresent();
        assertThat(cache.fresh("C", T0.plusMinutes(35))).isPresent();
    }

    private static CompanyNews news(String corpCode, LocalDateTime fetchedAt) {
        return new CompanyNews(corpCode, "회사" + corpCode, fetchedAt, List.of());
    }
}
