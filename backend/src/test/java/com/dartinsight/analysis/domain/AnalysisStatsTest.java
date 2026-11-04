package com.dartinsight.analysis.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class AnalysisStatsTest {

    @Test
    @DisplayName("백분위는 가장 가까운 순위(⌈p/100 × n⌉번째)이고 값이 없으면 null이다")
    void nearestRankPercentile() {
        assertThat(AnalysisStats.nearestRank(List.of(), 50)).isNull();
        assertThat(AnalysisStats.nearestRank(List.of(7L), 90)).isEqualTo(7L);
        assertThat(AnalysisStats.nearestRank(List.of(10L, 20L), 50)).isEqualTo(10L);
        assertThat(AnalysisStats.nearestRank(List.of(1L, 2L, 3L, 4L, 5L, 6L, 7L, 8L, 9L, 10L), 90)).isEqualTo(9L);
        assertThat(AnalysisStats.nearestRank(List.of(1L, 2L, 3L, 4L, 5L, 6L, 7L, 8L, 9L, 10L, 11L), 90))
                .isEqualTo(10L);
    }

    @Test
    @DisplayName("완료율은 소수 넷째 자리 반올림이고 분모가 0이면 null이다(0과 구분)")
    void completionRate() {
        assertThat(AnalysisStats.rate(0, 0)).isNull();
        assertThat(AnalysisStats.rate(0, 3)).isEqualTo(0.0);
        assertThat(AnalysisStats.rate(37, 40)).isEqualTo(0.925);
        assertThat(AnalysisStats.rate(2, 3)).isEqualTo(0.6667);
    }
}
