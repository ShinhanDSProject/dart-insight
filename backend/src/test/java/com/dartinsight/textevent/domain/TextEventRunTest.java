package com.dartinsight.textevent.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class TextEventRunTest {

    private static final LocalDateTime NOW = LocalDateTime.of(2026, 11, 5, 9, 0);

    private static TextEventRun pending() {
        return TextEventRun.create(1L, TextEvents.EVENT_VERSION, 1, "trace", NOW);
    }

    @Test
    @DisplayName("PENDING에서 RUNNING을 거쳐 COMPLETED로 바뀐다")
    void movesThroughRunningToCompleted() {
        TextEventRun run = pending();

        run.start(NOW);
        run.complete(2, NOW.plusMinutes(1));

        assertThat(run.getStatus()).isEqualTo(TextEventRunStatus.COMPLETED);
        assertThat(run.getDroppedEventCount()).isEqualTo(2);
        assertThat(run.getFinishedAt()).isEqualTo(NOW.plusMinutes(1));
    }

    @Test
    @DisplayName("RUNNING을 거치지 않고 COMPLETED로 바꾸면 거부한다")
    void completingWithoutRunningIsRejected() {
        assertThatThrownBy(() -> pending().complete(0, NOW)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("끝난 실행은 다른 상태로 바꿀 수 없다")
    void finishedRunCannotMove() {
        TextEventRun run = pending();
        run.start(NOW);
        run.fail("AI_LLM_UNAVAILABLE", NOW);

        assertThatThrownBy(() -> run.start(NOW)).isInstanceOf(IllegalStateException.class);
        assertThat(run.getErrorCode()).isEqualTo("AI_LLM_UNAVAILABLE");
    }

    @Test
    @DisplayName("대기 중인 실행은 대기열이 가득 차거나 서버가 다시 뜨면 바로 FAILED가 될 수 있다")
    void pendingRunCanFail() {
        TextEventRun run = pending();

        run.fail("ANALYSIS_EVENTS_BUSY", NOW);

        assertThat(run.getStatus()).isEqualTo(TextEventRunStatus.FAILED);
    }

    @Test
    @DisplayName("FAKE_MODEL은 다음 시작 때 새 실행을 만들고 NO_CANDIDATES는 그대로다")
    void onlyFakeModelStartsAgain() {
        TextEventRun fake = pending();
        fake.start(NOW);
        fake.notCreate(NotCreatedReason.FAKE_MODEL, NOW);
        TextEventRun none = pending();
        none.start(NOW);
        none.notCreate(NotCreatedReason.NO_CANDIDATES, NOW);

        assertThat(fake.startsAgain()).isTrue();
        assertThat(none.startsAgain()).isFalse();
    }
}
