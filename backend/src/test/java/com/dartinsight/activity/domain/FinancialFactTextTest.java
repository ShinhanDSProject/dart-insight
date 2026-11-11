package com.dartinsight.activity.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.dartinsight.analysis.domain.CalcStatus;
import com.dartinsight.analysis.domain.FinancialChange;
import com.dartinsight.analysis.domain.FinancialChangeRow;
import com.dartinsight.comparison.domain.AmountBasis;
import com.dartinsight.financial.domain.FsDiv;
import java.math.BigDecimal;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class FinancialFactTextTest {

    private static FinancialChange change(String sjDiv, FsDiv fsDiv, long previous, long current, BigDecimal rate,
            String currency) {
        return FinancialChange.of(1L, new FinancialChangeRow(sjDiv, fsDiv, "key", "영업이익", 1, AmountBasis.CUMULATIVE,
                previous, current, current - previous, rate, CalcStatus.OK, currency, null, null));
    }

    @Test
    @DisplayName("조 단위는 소수 한 자리, 증감률은 퍼센트로 쓴다")
    void formatsTrillionsAndRate() {
        assertThat(FinancialFactText.text(change("IS", FsDiv.CFS, 153_700_000_000_000L, 305_400_000_000_000L,
                new BigDecimal("0.987000"), "KRW")))
                .isEqualTo("연결 손익계산서 영업이익: 이전 153.7조원, 이번 305.4조원, 증감액 +151.7조원, 증감률 +98.7%");
    }

    @Test
    @DisplayName("줄어든 값은 음수로, 억 단위는 정수로 쓴다")
    void formatsDecreaseInHundredMillions() {
        assertThat(FinancialFactText.text(change("BS", FsDiv.OFS, 500_000_000L, 300_000_000L,
                new BigDecimal("-0.400000"), "KRW")))
                .isEqualTo("별도 재무상태표 영업이익: 이전 5억원, 이번 3억원, 증감액 -2억원, 증감률 -40.0%");
    }

    @Test
    @DisplayName("증감률이 없으면 빼고 원화가 아니면 통화를 그대로 쓴다")
    void omitsMissingRateAndKeepsCurrency() {
        assertThat(FinancialFactText.text(change("CF", FsDiv.CFS, 0L, 1_500L, null, "USD")))
                .isEqualTo("연결 현금흐름표 영업이익: 이전 0 USD, 이번 1,500 USD, 증감액 +1,500 USD");
    }

    @Test
    @DisplayName("근거 위치 이름은 재무제표와 계정을 잇는다")
    void labelsStatementAndAccount() {
        assertThat(FinancialFactText.label(change("IS", FsDiv.CFS, 1L, 2L, null, "KRW")))
                .isEqualTo("연결 손익계산서 > 영업이익");
    }
}
