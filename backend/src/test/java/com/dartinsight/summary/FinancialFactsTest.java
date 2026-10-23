package com.dartinsight.summary;

import static org.assertj.core.api.Assertions.assertThat;

import com.dartinsight.analysis.CalcStatus;
import com.dartinsight.analysis.FinancialChangeRow;
import com.dartinsight.comparison.domain.AmountBasis;
import com.dartinsight.financial.domain.FsDiv;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class FinancialFactsTest {

    private static FinancialChangeRow row(String name, long previous, long current, String rate, String currency) {
        return new FinancialChangeRow("IS", FsDiv.CFS, "k", name, 0, AmountBasis.CUMULATIVE, previous, current,
                current - previous, rate == null ? null : new BigDecimal(rate), CalcStatus.OK, currency, null, null);
    }

    @Test
    void sentenceUsesCodeMadeNumbersAndNeutralWords() {
        assertThat(FinancialFacts.sentence(row("매출액", 145_000_000_000_000L, 152_000_000_000_000L, "0.048276",
                "KRW"))).isEqualTo("매출액이 145조 원에서 152조 원으로 늘었어요(+4.8%).");
        assertThat(FinancialFacts.sentence(row("영업이익", 9_000_000_000L, 7_500_000_000L, "-0.166667", "KRW")))
                .isEqualTo("영업이익이 90억 원에서 75억 원으로 줄었어요(−16.7%).");
        assertThat(FinancialFacts.sentence(row("자산총계", 1_000, 1_200, null, "USD")))
                .isEqualTo("자산총계가 1,000 USD에서 1,200 USD(으)로 늘었어요.");
    }

    @Test
    void rateIsRoundedOnceFromTheTwoAmounts() {
        // 4.84996%: 저장된 소수 6자리(0.048500)를 다시 반올림하면 4.9%가 되지만 두 금액으로 바로 계산하면 4.8%
        assertThat(FinancialFacts.sentence(row("매출액", 10_000_000L, 10_484_996L, "0.048500", "KRW")))
                .endsWith("(+4.8%).");
    }

    @Test
    void amountsAreScaledToJoOrEok() {
        assertThat(FinancialFacts.amount(1_234_500_000_000L, "KRW")).isEqualTo("1.2조 원");
        assertThat(FinancialFacts.amount(-350_000_000L, "KRW")).isEqualTo("−4억 원");
        assertThat(FinancialFacts.amount(99_999_999L, null)).isEqualTo("99,999,999 원");
    }

    @Test
    void particlesFollowTheLastSyllable() {
        assertThat(FinancialFacts.subject("매출액")).isEqualTo("이");
        assertThat(FinancialFacts.subject("자산총계")).isEqualTo("가");
        assertThat(FinancialFacts.toward("원")).isEqualTo("으로");
        assertThat(FinancialFacts.toward("월")).isEqualTo("로");
        assertThat(FinancialFacts.toward("USD")).isEqualTo("(으)로");
        assertThat(FinancialFacts.toward("3")).isEqualTo("으로");
        assertThat(FinancialFacts.toward("2")).isEqualTo("로");
    }
}
