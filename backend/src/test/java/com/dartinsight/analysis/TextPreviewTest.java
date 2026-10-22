package com.dartinsight.analysis;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class TextPreviewTest {

    @Test
    void shortTextIsKeptWhole() {
        assertThat(TextPreview.cut("짧은 글", 0)).isEqualTo("짧은 글");
        assertThat(TextPreview.cut(null, 0)).isNull();
    }

    @Test
    void longTextIsCutAroundTheFirstDifference() {
        String before = "앞 ".repeat(200);
        String a = before + "이전 표현입니다.";
        String b = before + "새 표현입니다.";

        int from = TextPreview.firstDifference(a, b);
        String preview = TextPreview.cut(b, from);

        assertThat(from).isEqualTo(before.length());
        assertThat(preview).startsWith("…").contains("새 표현입니다.");
        assertThat(preview.length()).isLessThanOrEqualTo(TextPreview.LENGTH + 2);
    }

    @Test
    void longTextWithoutDifferenceStartsAtTheBeginning() {
        String text = "가".repeat(500);

        assertThat(TextPreview.cut(text, 0)).doesNotStartWith("…").endsWith("…");
    }
}
