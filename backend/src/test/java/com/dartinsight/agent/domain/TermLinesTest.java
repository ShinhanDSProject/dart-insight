package com.dartinsight.agent.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.dartinsight.glossary.domain.GlossaryCompanyValue;
import com.dartinsight.glossary.domain.GlossaryLevel;
import com.dartinsight.glossary.domain.GlossarySource;
import com.dartinsight.glossary.domain.GlossaryTerm;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class TermLinesTest {

    private static final GlossaryTerm DEBT_RATIO = new GlossaryTerm("debtRatio", GlossaryLevel.CORE, "부채비율",
            List.of("부채 비율"), "부채총계를 자본총계로 나눈 비율이에요.", "자본총계가 100원이고 부채총계가 30원이면 30%예요.",
            "재무상태표", "이 숫자 하나로 좋고 나쁨을 정하지 않아요.", List.of("asset", "draft"),
            new GlossaryCompanyValue("DEBT_RATIO", List.of("부채총계", "자본총계")),
            List.of(new GlossarySource("공식 자료", "https://example.test")), "검토자", LocalDate.of(2026, 11, 10));

    @Test
    @DisplayName("찾은 카드는 G{키} 근거로, 줄 글에는 카드 칸을 모두 넣는다")
    void cardLineHasGlossaryEvidenceAndEveryField() {
        ToolLine line = TermLines.card(DEBT_RATIO, Map.of("debtRatio", "부채비율", "asset", "자산"));

        assertThat(line.evidence().evidenceId()).isEqualTo("GdebtRatio");
        assertThat(line.evidence().kind()).isEqualTo(Evidence.Kind.GLOSSARY);
        assertThat(line.evidence().term().term()).isEqualTo("부채비율");
        assertThat(line.evidence().term().sources()).containsExactly(new Evidence.Source("공식 자료", "https://example.test"));
        assertThat(line.text()).contains("[용어 카드 부채비율, 핵심 카드, 키 debtRatio] 한 줄 뜻: 부채총계를",
                "쉬운 예시(가정한 예, 이 회사의 값이 아님): 자본총계가 100원", "확인할 곳: 재무상태표",
                "판단하지 않음: 이 숫자 하나로", "별칭: 부채 비율", "관련 용어: 자산(asset)",
                "체크 포인트 DEBT_RATIO", "재무 계정 부채총계·자본총계", "출처: 공식 자료");
        // 내보낼 수 없는 카드(draft)는 관련 용어에 넣지 않는다
        assertThat(line.text()).doesNotContain("draft");
    }

    private static GlossaryTerm longCard(String key, int definitionChars) {
        return new GlossaryTerm(key, GlossaryLevel.CORE, key + "용어", List.of(), "가".repeat(definitionChars), null,
                null, null, List.of(), null, List.of(new GlossarySource("공식 자료", "https://example.test")), "검토자",
                LocalDate.of(2026, 11, 10));
    }

    private static List<ToolLine> longCards(int definitionChars) {
        return List.of(TermLines.card(longCard("first", definitionChars), Map.of()),
                TermLines.card(longCard("second", definitionChars), Map.of()),
                TermLines.card(longCard("third", definitionChars), Map.of()));
    }

    @Test
    @DisplayName("긴 카드 3개가 결과 4,000자를 넘으면 truncated이고, 순서와 근거 ID는 그대로 두고 마지막 줄 글만 자른다")
    void longCardsAreCutAtResultLimitKeepingOrderAndEvidence() {
        ToolLines.Limited limited = ToolLines.limit(longCards(1500), 10, 4000);

        assertThat(limited.truncated()).isTrue();
        assertThat(limited.lines()).extracting(l -> l.evidence().evidenceId())
                .containsExactly("Gfirst", "Gsecond", "Gthird");
        assertThat(limited.lines().get(0).text()).isEqualTo(longCards(1500).get(0).text());
        assertThat(limited.lines().get(2).text()).endsWith("…");
        int total = limited.lines().stream().mapToInt(l -> l.text().length()).sum();
        assertThat(total).isEqualTo(4000 + 1);
    }

    @Test
    @DisplayName("카드가 더 길어 4,000자를 앞의 카드가 다 쓰면 남은 카드 줄은 빠지고 truncated로만 알린다(공통 제한 그대로)")
    void cardsBeyondResultLimitAreDroppedAndMarkedTruncated() {
        ToolLines.Limited limited = ToolLines.limit(longCards(2500), 10, 4000);

        assertThat(limited.truncated()).isTrue();
        assertThat(limited.lines()).extracting(l -> l.evidence().evidenceId()).containsExactly("Gfirst", "Gsecond");
        assertThat(limited.lines().get(1).text()).endsWith("…");
    }

    @Test
    @DisplayName("카드가 없으면 근거 없는 줄로 '등록되지 않았어요'와 비슷한 카드만 알린다")
    void notFoundLineHasNoEvidenceAndListsSimilarCards() {
        ToolLine none = TermLines.notFound("배당", List.of());
        ToolLine similar = TermLines.notFound("부채율", List.of(DEBT_RATIO));

        assertThat(none.evidence()).isNull();
        assertThat(none.text()).isEqualTo("[용어 카드 없음] '배당'에 해당하는 용어 카드는 등록되지 않았어요.");
        assertThat(similar.text()).endsWith("비슷한 카드: 부채비율(debtRatio)");
    }
}
