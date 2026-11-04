package com.dartinsight.agent.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class AskedQuestionTest {

    private static final AskedQuestion LAWSUIT = new AskedQuestion(7, 1, true, Set.of("R#B5"));
    private static final AskedQuestion SALES = new AskedQuestion(8, 1, true, Set.of("R#B9", "F31"));
    private static final AskedQuestion MISSED = new AskedQuestion(9, 0, false, Set.of());

    @Test
    @DisplayName("최종 답이 근거를 인용한 답한 질문 중 마지막 것을 평가 대상으로 고른다")
    void picksLastAnsweredQuestionCitedByAnswer() {
        assertThat(AskedQuestion.ratedBy(List.of(LAWSUIT, SALES), List.of("R#B5", "F31"))).isEqualTo(8L);
        assertThat(AskedQuestion.ratedBy(List.of(LAWSUIT, SALES), List.of("R#B5"))).isEqualTo(7L);
    }

    @Test
    @DisplayName("최종 답이 질문의 근거를 쓰지 않았거나 답한 질문이 없으면 평가 대상이 없다")
    void returnsNullWhenAnswerIsNotFromAnsweredQuestion() {
        assertThat(AskedQuestion.ratedBy(List.of(LAWSUIT, MISSED), List.of("T5012"))).isNull();
        assertThat(AskedQuestion.ratedBy(List.of(MISSED), List.of("R#B5"))).isNull();
        assertThat(AskedQuestion.ratedBy(List.of(), List.of("R#B5"))).isNull();
    }
}
