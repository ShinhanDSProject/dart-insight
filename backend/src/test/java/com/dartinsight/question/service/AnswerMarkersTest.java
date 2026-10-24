package com.dartinsight.question.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class AnswerMarkersTest {

    private static final Set<String> SENT = Set.of("R#B1", "R#B2", "P#B3");
    private static final Set<String> FACTS = Set.of("F1", "F2");

    @Test
    @DisplayName("근거 ID는 처음 나온 순서대로 번호로 바꾸고 사실 표시는 그대로 둔다")
    void evidenceIdsBecomeNumbersInOrderOfFirstAppearance() {
        AnswerMarkers.Converted converted = AnswerMarkers.convert(
                "가[P#B3]. 나[R#B1][F2]. 다[P#B3, R#B1]. 라[F1].", SENT, FACTS);

        assertThat(converted.valid()).isTrue();
        assertThat(converted.answer()).isEqualTo("가[1]. 나[2][F2]. 다[1][2]. 라[F1].");
        assertThat(converted.evidenceIds()).containsExactly("P#B3", "R#B1");
        assertThat(converted.factRefs()).containsExactly("F1", "F2");
        assertThat(AnswerMarkers.factRefs(converted.answer())).containsExactly("F1", "F2");
    }

    @Test
    @DisplayName("보낸 적 없는 표시가 있거나 표시가 하나도 없으면 확인하지 못한 답이다")
    void unknownOrMissingMarkersAreInvalid() {
        assertThat(AnswerMarkers.convert("가[R#B9].", SENT, FACTS).valid()).isFalse();
        assertThat(AnswerMarkers.convert("가[F3].", SENT, FACTS).valid()).isFalse();
        assertThat(AnswerMarkers.convert("근거 없는 답이에요.", SENT, FACTS).valid()).isFalse();
        assertThat(AnswerMarkers.convert(null, SENT, FACTS).valid()).isFalse();
    }
}
