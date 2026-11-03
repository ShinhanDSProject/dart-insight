package com.dartinsight.agent.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ToolLinesTest {

    private static ToolLine line(String text) {
        return new ToolLine(null, text);
    }

    @Test
    @DisplayName("줄 수를 넘기면 앞에서부터 자르고 truncated다")
    void cutsLinesBeyondMaxItems() {
        ToolLines.Limited limited = ToolLines.limit(List.of(line("a"), line("b"), line("c")), 2, 100);

        assertThat(limited.lines()).extracting(ToolLine::text).containsExactly("a", "b");
        assertThat(limited.truncated()).isTrue();
    }

    @Test
    @DisplayName("글의 합이 상한을 넘으면 마지막 줄을 잘라 말줄임표를 붙인다")
    void clipsTextBeyondMaxChars() {
        ToolLines.Limited limited = ToolLines.limit(List.of(line("가나다"), line("라마바사")), 10, 5);

        assertThat(limited.lines()).extracting(ToolLine::text).containsExactly("가나다", "라마…");
        assertThat(limited.truncated()).isTrue();
    }

    @Test
    @DisplayName("상한 안이면 그대로이고 truncated가 아니다")
    void keepsLinesWithinLimits() {
        ToolLines.Limited limited = ToolLines.limit(List.of(line("a")), 10, 100);

        assertThat(limited.lines()).extracting(ToolLine::text).containsExactly("a");
        assertThat(limited.truncated()).isFalse();
    }
}
