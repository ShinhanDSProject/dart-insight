package com.dartinsight.summary.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.dartinsight.analysis.domain.TextChangeRow;
import com.dartinsight.analysis.domain.TextChangeRow.Side;
import com.dartinsight.summary.domain.SummaryItemRow;
import com.dartinsight.summary.dto.SummaryAiResponse;
import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class SummaryResultsTest {

    private static final String PREV = "20250814000001";
    private static final String CUR = "20260814000001";
    private static final SummaryAiResponse EMPTY = new SummaryAiResponse("v1", "fake-model", "2026-10-27T10:00:00",
            List.of(), List.of());

    private static TextChangeRow modified(Side previous, Side current) {
        return new TextChangeRow(TextChangeRow.MODIFIED, "PARAGRAPH", false, "MATCHED", "1. 사업의 개요",
                "II. 사업의 내용 > 1. 사업의 개요", previous, current, new BigDecimal("0.7000"), null);
    }

    private static SummaryAiResponse.Item ok(String ref, List<String> evidenceIds) {
        return new SummaryAiResponse.Item(ref, "TEXT", "OK", "사업 설명이 늘었다.", null, evidenceIds, null, null,
                null, null, null);
    }

    @Test
    @DisplayName("짝지은 원문이 한쪽이라도 있으면 풀이할 수 있고, 근거 ID는 접수번호와 블록 번호로 만든다")
    void buildsSourcesFromSidesWithBlockAndText() {
        TextChangeRow row = modified(new Side(PREV, 2, 1, "이전 문단"), new Side(CUR, 2, null, null));

        assertThat(SummaryResults.explainable(row)).isTrue();
        assertThat(SummaryResults.ids(SummaryResults.sources(row))).containsExactly(PREV + "#B1");
    }

    @Test
    @DisplayName("원문이 없거나 검토 필요 유형인 변경은 풀이하지 않는다")
    void doesNotExplainWithoutSourceOrReviewNeeded() {
        TextChangeRow noSource = modified(null, new Side(CUR, 2, null, null));
        TextChangeRow review = new TextChangeRow(TextChangeRow.REVIEW_NEEDED, "PARAGRAPH", false, "MATCHED",
                "1. 사업의 개요", "II. 사업의 내용 > 1. 사업의 개요", new Side(PREV, 2, 1, "이전 문단"), null, null, null);

        assertThat(SummaryResults.explainable(noSource)).isFalse();
        assertThat(SummaryResults.explainable(review)).isFalse();
    }

    @Test
    @DisplayName("보낸 원문 위치만 인용한 문장 요약은 보이고, 다른 위치를 인용하면 검토 필요로 남긴다")
    void showsTextOnlyWhenCitingSentSources() {
        Set<String> allowed = Set.of(PREV + "#B1");

        SummaryItemRow shown = SummaryResults.textRow(ok("T1", List.of(PREV + "#B1")), 1, allowed, EMPTY, null);
        SummaryItemRow foreign = SummaryResults.textRow(ok("T1", List.of(CUR + "#B9")), 1, allowed, EMPTY, null);
        SummaryItemRow missing = SummaryResults.textRow(null, 1, allowed, EMPTY, null);

        assertThat(shown.status()).isEqualTo(SummaryItemRow.SHOWN);
        assertThat(foreign.reviewNeeded()).isTrue();
        assertThat(missing.reviewNeeded()).isTrue();
    }

    @Test
    @DisplayName("요청하지 않은 항목은 빼고 같은 항목이 두 번 오면 처음 것만 쓴다")
    void keepsOnlyRequestedFirstAnswers() {
        SummaryAiResponse response = new SummaryAiResponse("v1", "fake-model", null, List.of(
                ok("T1", List.of("a")), ok("T1", List.of("b")), ok("T9", List.of("c"))), List.of());

        var answers = SummaryResults.answers(response, "T1"::equals);

        assertThat(answers).containsOnlyKeys("T1");
        assertThat(answers.get("T1").evidenceIds()).containsExactly("a");
    }
}
