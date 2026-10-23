package com.dartinsight.analysis.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.dartinsight.comparison.domain.ComparisonBasis;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;

class AnalysisStatusTest {

    private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 21, 9, 0);

    private static Analysis requested() {
        return Analysis.request("00000001", "20260814000001", "20250814000001", ComparisonBasis.YOY, "trace", NOW);
    }

    @Test
    void onlyAllowedTransitions() {
        assertThat(AnalysisStatus.PENDING.canMoveTo(AnalysisStatus.RUNNING)).isTrue();
        assertThat(AnalysisStatus.PENDING.canMoveTo(AnalysisStatus.FAILED)).isTrue();
        assertThat(AnalysisStatus.PENDING.canMoveTo(AnalysisStatus.COMPLETED)).isFalse();
        assertThat(AnalysisStatus.RUNNING.canMoveTo(AnalysisStatus.COMPLETED)).isTrue();
        assertThat(AnalysisStatus.RUNNING.canMoveTo(AnalysisStatus.PENDING)).isFalse();
        assertThat(AnalysisStatus.COMPLETED.canMoveTo(AnalysisStatus.FAILED)).isFalse();
        assertThat(AnalysisStatus.FAILED.canMoveTo(AnalysisStatus.RUNNING)).isFalse();
    }

    @Test
    void cannotCompleteWithoutRunning() {
        Analysis analysis = requested();

        assertThatThrownBy(() -> analysis.complete(NOW)).isInstanceOf(IllegalStateException.class);
        assertThat(analysis.getStatus()).isEqualTo(AnalysisStatus.PENDING);
    }

    @Test
    void stepsOnlyMoveForward() {
        Analysis analysis = requested();
        analysis.start(NOW);
        analysis.advance(AnalysisStep.COMPARING, NOW);

        assertThatThrownBy(() -> analysis.advance(AnalysisStep.RECEIVED, NOW))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> analysis.advance(AnalysisStep.DONE, NOW))
                .as("완료 단계는 결과를 저장할 때만")
                .isInstanceOf(IllegalStateException.class);
        analysis.advance(AnalysisStep.VERIFYING, NOW);
        analysis.complete(NOW);
        assertThat(analysis.getStep()).isEqualTo(AnalysisStep.DONE);
        assertThat(analysis.getStatus()).isEqualTo(AnalysisStatus.COMPLETED);
    }

    @Test
    void failureKeepsStepAndReason() {
        Analysis analysis = requested();
        analysis.start(NOW);
        analysis.advance(AnalysisStep.COMPARING, NOW);

        analysis.fail("DART_RATE_LIMITED", "한도 초과", NOW);

        assertThat(analysis.getStatus()).isEqualTo(AnalysisStatus.FAILED);
        assertThat(analysis.getStep()).isEqualTo(AnalysisStep.COMPARING);
        assertThat(analysis.getErrorCode()).isEqualTo("DART_RATE_LIMITED");
        assertThatThrownBy(() -> analysis.start(NOW)).isInstanceOf(IllegalStateException.class);
    }
}
