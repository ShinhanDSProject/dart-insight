package com.dartinsight.note.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.dartinsight.analysis.domain.CalcStatus;
import com.dartinsight.analysis.domain.FinancialChange;
import com.dartinsight.analysis.domain.FinancialChangeRow;
import com.dartinsight.comparison.domain.AmountBasis;
import com.dartinsight.financial.domain.FsDiv;
import java.math.BigDecimal;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class FinancialNoteTextTest {

    private static FinancialChange change(String sjDiv, String detail, Long previous, Long current, Long change,
            BigDecimal rate, CalcStatus status, String currency) {
        return FinancialChange.of(1L, new FinancialChangeRow(sjDiv, FsDiv.CFS, "a", "매출액", 1, AmountBasis.POINT,
                previous, current, change, rate, status, currency, null, null, detail));
    }

    @Test
    @DisplayName("이름은 재무제표 이름과 계정이고, 자본변동표는 계정 상세의 마지막 구성요소를 꼬리표 없이 더한다")
    void labelAddsLastEquityComponent() {
        assertThat(FinancialNoteText.label(change("IS", null, 1L, 2L, 1L, null, CalcStatus.OK, "KRW")))
                .isEqualTo("손익계산서 · 매출액");
        assertThat(FinancialNoteText.label(change("SCE", "자본 [member]|이익잉여금 [member]", 1L, 2L, 1L, null,
                CalcStatus.OK, "KRW"))).isEqualTo("자본변동표 · 매출액 · 이익잉여금");
    }

    @Test
    @DisplayName("값 문장은 금액을 자리마다 끊고 증감에 부호와 비율을 붙이며, 계산하지 않았으면 사유를 붙인다")
    void textFormatsAmountsAndReasons() {
        assertThat(FinancialNoteText.text(change("IS", null, 1000L, 1200L, 200L, new BigDecimal("0.2"),
                CalcStatus.OK, "KRW"))).isEqualTo("이전 1,000원 → 현재 1,200원, 증감 +200원(+20.0%)");
        assertThat(FinancialNoteText.text(change("IS", null, 1000L, -500L, -1500L, new BigDecimal("-1.5"),
                CalcStatus.OK, "USD"))).isEqualTo("이전 1,000 USD → 현재 −500 USD, 증감 −1,500 USD(−150.0%)");
        assertThat(FinancialNoteText.text(change("IS", null, null, 1200L, null, null, CalcStatus.ONLY_CURRENT,
                "KRW"))).isEqualTo("이전 없음 → 현재 1,200원. " + CalcStatus.ONLY_CURRENT.message());
    }
}
