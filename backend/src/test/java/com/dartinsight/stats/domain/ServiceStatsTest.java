package com.dartinsight.stats.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.LocalDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ServiceStatsTest {

    private static final LocalDateTime COUNTED = LocalDateTime.of(2026, 11, 10, 17, 0);
    private static final ServiceStats STATS = new ServiceStats(1, 2, 3, COUNTED);

    @Test
    @DisplayName("센 시각부터 TTL 안이면 그대로 쓰고, TTL이 지나면 다시 센다")
    void freshOnlyWithinTtl() {
        Duration ttl = Duration.ofMinutes(10);
        assertThat(STATS.freshAt(COUNTED.plusMinutes(9), ttl)).isTrue();
        assertThat(STATS.freshAt(COUNTED.plusMinutes(10), ttl)).isFalse();
    }
}
