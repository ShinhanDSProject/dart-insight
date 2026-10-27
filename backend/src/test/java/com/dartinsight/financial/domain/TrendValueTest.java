package com.dartinsight.financial.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.dartinsight.report.domain.ReportType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class TrendValueTest {

    private static KeyAccountRow row(KeyAccount account, Long amount, Long cumulative) {
        return new KeyAccountRow("20260814000001", FsDiv.CFS, account, account.sjDiv(), account.label(), 1, amount,
                cumulative, "KRW");
    }

    @Test
    @DisplayName("손익은 누적을 amount로, 3개월을 quarterAmount로 두고 재무상태표는 기말 잔액만 둔다")
    void picksAmountBasisByReportType() {
        KeyAccountRow revenue = row(KeyAccount.REVENUE, 171L, 305L);
        assertThat(TrendValue.of(ReportType.HALF, revenue))
                .isEqualTo(new TrendValue(305L, 171L, "KRW"));
        assertThat(TrendValue.of(ReportType.Q3, revenue))
                .isEqualTo(new TrendValue(305L, 171L, "KRW"));
        // 1분기는 3개월이 곧 누적. 누적 값이 없으면 당기금액을 쓴다
        assertThat(TrendValue.of(ReportType.Q1, row(KeyAccount.REVENUE, 79L, null)))
                .isEqualTo(new TrendValue(79L, 79L, "KRW"));
        // 사업보고서 당기금액은 1년이고 4분기 3개월 값은 없다
        assertThat(TrendValue.of(ReportType.ANNUAL, row(KeyAccount.REVENUE, 333L, null)))
                .isEqualTo(new TrendValue(333L, null, "KRW"));
        assertThat(TrendValue.of(ReportType.HALF, row(KeyAccount.TOTAL_ASSETS, 759L, null)))
                .isEqualTo(new TrendValue(759L, null, "KRW"));
        // 분·반기 누적이 없으면 0으로 메우지 않고 null
        assertThat(TrendValue.of(ReportType.HALF, row(KeyAccount.REVENUE, 171L, null)).amount())
                .isNull();
    }
}
