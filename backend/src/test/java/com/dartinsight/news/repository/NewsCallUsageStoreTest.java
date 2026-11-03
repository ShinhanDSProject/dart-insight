package com.dartinsight.news.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.dartinsight.support.TestData;
import java.sql.Date;
import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest
class NewsCallUsageStoreTest {

    private static final LocalDate DAY = LocalDate.of(2026, 11, 3);

    @Autowired
    private NewsCallUsageStore store;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        TestData.clearAll(jdbcTemplate);
    }

    @Test
    @DisplayName("그날 한도까지만 세고, 날짜가 바뀌면 새 행에서 다시 센다. 센 횟수는 DB에 남는다")
    void countsUpToDailyLimitInDatabase() {
        assertThat(store.tryUse(DAY, 2)).isTrue();
        assertThat(store.tryUse(DAY, 2)).isTrue();
        assertThat(store.tryUse(DAY, 2)).isFalse();
        assertThat(store.tryUse(DAY.plusDays(1), 2)).isTrue();

        assertThat(jdbcTemplate.queryForObject("SELECT call_count FROM news_call_usage WHERE usage_date = ?",
                Integer.class, Date.valueOf(DAY))).isEqualTo(2);
        assertThat(store.tryUse(DAY.plusDays(2), 0)).isFalse();
    }
}
