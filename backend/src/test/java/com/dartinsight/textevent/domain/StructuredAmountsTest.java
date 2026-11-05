package com.dartinsight.textevent.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.dartinsight.disclosure.domain.DisclosureKeyItems;
import com.dartinsight.disclosure.domain.KeyItem;
import com.dartinsight.disclosure.domain.KeyItemKind;
import com.dartinsight.disclosure.domain.KeyItemStatus;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class StructuredAmountsTest {

    private static final LocalDateTime NOW = LocalDateTime.of(2026, 11, 5, 9, 0);

    private static KeyItem item(String field, String value) {
        return new KeyItem(field, field, value, "원");
    }

    private static DisclosureKeyItems keyItems(KeyItemKind kind, KeyItem... items) {
        return new DisclosureKeyItems("20260219002746", kind, KeyItemStatus.AVAILABLE, List.of(items), NOW, null);
    }

    @Test
    @DisplayName("유상증자의 자금조달 항목이 하나면 그 필드와 금액을 쓴다(고려아연 20260219002746)")
    void singleFundingFieldKeepsItsName() {
        StructuredAmount amount = StructuredAmounts.of(keyItems(KeyItemKind.CAPITAL_INCREASE,
                item("fv_ps", "5,000"), item("fdpp_ocsa", "2,833,562,221,325"))).orElseThrow();

        assertThat(amount.rceptNo()).isEqualTo("20260219002746");
        assertThat(amount.kind()).isEqualTo(KeyItemKind.CAPITAL_INCREASE);
        assertThat(amount.field()).isEqualTo("fdpp_ocsa");
        assertThat(amount.amount()).isEqualTo(2_833_562_221_325L);
    }

    @Test
    @DisplayName("유상증자의 자금조달 항목이 여럿이면 그 결정 안에서 더해 필드를 fdpp로 보낸다")
    void severalFundingFieldsAreSummedAsFdpp() {
        StructuredAmount amount = StructuredAmounts.of(keyItems(KeyItemKind.CAPITAL_INCREASE,
                item("fdpp_fclt", "1,000"), item("fdpp_op", "234"))).orElseThrow();

        assertThat(amount.field()).isEqualTo("fdpp");
        assertThat(amount.amount()).isEqualTo(1234L);
    }

    @Test
    @DisplayName("사채는 권면총액, 자기주식은 예정금액, 양수는 양수금액을 쓴다")
    void kindsUseTheirOwnAmountFields() {
        assertThat(StructuredAmounts.of(keyItems(KeyItemKind.CONVERTIBLE_BOND, item("bd_fta", "100"),
                item("fdpp_op", "90"))).orElseThrow().field()).isEqualTo("bd_fta");
        assertThat(StructuredAmounts.of(keyItems(KeyItemKind.TREASURY_STOCK_ACQUISITION,
                item("aqpln_prc_ostk", "100"), item("aqpln_prc_estk", "20"))).orElseThrow().amount()).isEqualTo(120L);
        assertThat(StructuredAmounts.of(keyItems(KeyItemKind.TREASURY_STOCK_DISPOSAL,
                item("dpstk_prc_ostk", "7"), item("dppln_prc_ostk", "100"))).orElseThrow().field())
                .isEqualTo("dppln_prc_ostk");
        assertThat(StructuredAmounts.of(keyItems(KeyItemKind.STOCK_ACQUISITION,
                item("inhdtl_inhprc", "100"))).orElseThrow().field()).isEqualTo("inhdtl_inhprc");
    }

    @Test
    @DisplayName("소송은 금액 항목이 없고, 값이 없거나 숫자가 아니거나 0이면 쓰지 않는다")
    void noUsableAmountIsEmpty() {
        assertThat(StructuredAmounts.of(keyItems(KeyItemKind.LITIGATION, item("icnm", "사건")))).isEmpty();
        assertThat(StructuredAmounts.of(keyItems(KeyItemKind.CAPITAL_INCREASE))).isEmpty();
        assertThat(StructuredAmounts.of(keyItems(KeyItemKind.CAPITAL_INCREASE, item("fdpp_op", "미정")))).isEmpty();
        assertThat(StructuredAmounts.of(keyItems(KeyItemKind.CAPITAL_INCREASE, item("fdpp_op", "0")))).isEmpty();
    }

    @Test
    @DisplayName("행의 접수번호가 요청한 공시와 다르면 행의 접수번호를 근거로 쓴다")
    void sourceRceptNoWins() {
        DisclosureKeyItems items = new DisclosureKeyItems("20260630000676", KeyItemKind.CAPITAL_INCREASE,
                KeyItemStatus.AVAILABLE, List.of(item("fdpp_op", "100")), NOW, "20261013000198");

        assertThat(StructuredAmounts.of(items).orElseThrow().rceptNo()).isEqualTo("20261013000198");
    }
}
