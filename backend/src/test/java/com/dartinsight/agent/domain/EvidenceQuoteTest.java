package com.dartinsight.agent.domain;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class EvidenceQuoteTest {

    /** 카카오 T48922처럼 용어가 154번째 글자부터 나오는 461자 문단 */
    private static final String LONG = "가".repeat(153) + "전환사채의 조기상환청구 1차분 370,854백만원" + "나".repeat(280);

    @Test
    @DisplayName("검색어가 문단 앞 160자 끝에 걸리면 검색어 앞 40자부터 인용하고 잘린 앞·뒤에 말줄임표를 붙인다")
    void movesQuoteToTheSearchTermNearTheCut() {
        Evidence evidence = Evidence.textChange(48922L, "DELETED", "20250324000901", "XI. 그 밖에", LONG, "전환사채");

        assertThat(evidence.quote())
                .startsWith("…" + "가".repeat(Evidence.QUOTE_LEAD) + "전환사채")
                .contains("370,854백만원")
                .endsWith("…")
                .hasSize(Evidence.QUOTE_CHARS + 2);
    }

    @Test
    @DisplayName("검색어가 문단 끝 가까이에 있으면 끝 160자를 인용하고 앞에만 말줄임표를 붙인다")
    void quotesTheEndWhenTheSearchTermIsNearTheEnd() {
        String text = "가".repeat(300) + "전환사채 발행";

        String quote = Evidence.quote(text, "전환사채");

        assertThat(quote).isEqualTo("…" + text.substring(text.length() - Evidence.QUOTE_CHARS));
    }

    @Test
    @DisplayName("검색어가 앞부분에 있고 뒤가 넉넉히 이어지면 지금처럼 문단 앞 160자다")
    void keepsTheHeadWhenTheSearchTermFitsWithRoom() {
        String text = "전환사채를 발행했습니다. " + "가".repeat(300);

        assertThat(Evidence.quote(text, "전환사채")).isEqualTo(text.substring(0, Evidence.QUOTE_CHARS));
    }

    @Test
    @DisplayName("검색어가 없거나 문단에 없으면 문단 앞 160자이고, 160자 이하 문단은 그대로다")
    void keepsTheHeadWithoutASearchTerm() {
        assertThat(Evidence.quote(LONG, null)).isEqualTo(LONG.substring(0, Evidence.QUOTE_CHARS));
        assertThat(Evidence.quote(LONG, "신주인수권")).isEqualTo(LONG.substring(0, Evidence.QUOTE_CHARS));
        assertThat(Evidence.quote("짧은 전환사채 문단", "전환사채")).isEqualTo("짧은 전환사채 문단");
    }

    @Test
    @DisplayName("검색어는 대소문자를 가리지 않는다(문장 변경 검색과 같음)")
    void matchesTheSearchTermIgnoringCase() {
        String text = "가".repeat(200) + "CB 발행" + "나".repeat(200);

        assertThat(Evidence.quote(text, "cb")).startsWith("…" + "가".repeat(Evidence.QUOTE_LEAD) + "CB");
    }
}
