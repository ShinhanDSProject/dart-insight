package com.dartinsight.disclosure.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/**
 * 핵심 수치 종류 규칙표. 보고서명은 실제 OpenDART 공시검색 응답(주요사항보고 pblntf_ty=B, 2026-08-01~10-26)에서 옮겼다.
 */
class KeyItemRulesTest {

    @ParameterizedTest(name = "{0} → {1}")
    @DisplayName("실제 보고서명에서 종류를 정한다")
    @CsvSource(delimiter = '|', nullValues = "NONE", textBlock = """
            주요사항보고서(유상증자결정)                         | CAPITAL_INCREASE
            [기재정정]주요사항보고서(유상증자결정)                | CAPITAL_INCREASE
            주요사항보고서(전환사채권발행결정)                    | CONVERTIBLE_BOND
            [기재정정]주요사항보고서(전환사채권발행결정)           | CONVERTIBLE_BOND
            주요사항보고서(신주인수권부사채권발행결정)              | BOND_WITH_WARRANT
            주요사항보고서(교환사채권발행결정)                    | EXCHANGEABLE_BOND
            주요사항보고서(자기주식취득결정)                      | TREASURY_STOCK_ACQUISITION
            주요사항보고서(자기주식처분결정)                      | TREASURY_STOCK_DISPOSAL
            [첨부정정]주요사항보고서(전환사채권발행결정)           | NONE
            [첨부정정]주요사항보고서(유상증자결정)                | NONE
            유상증자결정                                       | NONE
            [기재정정]유상증자결정                              | NONE
            주요사항보고서(자기전환사채만기전취득결정)              | NONE
            주요사항보고서(자기신주인수권부사채만기전취득결정)       | NONE
            주요사항보고서(자기주식취득신탁계약체결결정)            | NONE
            주요사항보고서(유무상증자결정)                        | NONE
            주요사항보고서(자본으로인정되는채무증권발행결정)        | NONE
            주요사항보고서(회사합병결정)                          | NONE
            반기보고서 (2026.06)                                | NONE
            """)
    void classifiesRealReportNames(String reportName, KeyItemKind expected) {
        assertThat(KeyItemRules.classify(reportName).orElse(null)).isEqualTo(expected);
    }

    @Test
    @DisplayName("[기재정정]만 정정 공시로 본다")
    void detectsCorrection() {
        assertThat(KeyItemRules.corrected("[기재정정]주요사항보고서(유상증자결정)")).isTrue();
        assertThat(KeyItemRules.corrected("주요사항보고서(유상증자결정)")).isFalse();
        assertThat(KeyItemRules.corrected("[첨부정정]주요사항보고서(유상증자결정)")).isFalse();
    }

    @Test
    @DisplayName("항목은 원문 값 그대로 정한 순서로 꺼내고 '-'와 빈 값은 뺀다")
    void itemsKeepOriginalValues() {
        Map<String, String> row = Map.of("aqpln_stk_ostk", " 364,698 ", "aqpln_stk_estk", "-",
                "aqpln_prc_ostk", "500,000,958", "aq_pp", "", "aq_dd", "2026년 10월 26일");
        assertThat(KeyItemKind.TREASURY_STOCK_ACQUISITION.items(row)).containsExactly(
                new KeyItem("aqpln_stk_ostk", "취득예정주식(보통주식)", "364,698", "주"),
                new KeyItem("aqpln_prc_ostk", "취득예정금액(보통주식)", "500,000,958", "원"),
                new KeyItem("aq_dd", "취득결정일", "2026년 10월 26일", null));
    }
}
