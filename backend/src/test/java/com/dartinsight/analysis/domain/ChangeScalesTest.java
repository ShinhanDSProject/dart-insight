package com.dartinsight.analysis.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.dartinsight.analysis.domain.ChangeScale.Base;
import com.dartinsight.analysis.domain.ChangeScale.Reason;
import com.dartinsight.analysis.domain.FinancialChangeRow.Evidence;
import com.dartinsight.comparison.domain.AmountBasis;
import com.dartinsight.financial.domain.FsDiv;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ChangeScalesTest {

    private static final String PREV = "20250814000001";
    private static final String CUR = "20260814000001";

    /** 두 보고서에 다 있는 계정. 증감액은 현재 − 이전, 둘 중 하나가 없으면 null */
    private static FinancialChange change(String sjDiv, String accountId, String name, int order, Long previous,
            Long current) {
        Long amount = previous == null || current == null ? null : current - previous;
        CalcStatus status = amount == null ? CalcStatus.CURRENT_MISSING : CalcStatus.OK;
        return FinancialChange.of(1L, new FinancialChangeRow(sjDiv, FsDiv.CFS, accountId, name, order,
                AmountBasis.CUMULATIVE, previous, current, amount, null, status, "KRW",
                new Evidence(PREV, sjDiv, accountId, name, "제 56 기"),
                new Evidence(CUR, sjDiv, accountId, name, "제 57 기")));
    }

    /** 이전 보고서에만 있는 계정 */
    private static FinancialChange onlyPrevious(String sjDiv, String accountId, String name, int order) {
        return FinancialChange.of(1L, new FinancialChangeRow(sjDiv, FsDiv.CFS, accountId, name, order,
                AmountBasis.CUMULATIVE, 100L, null, null, null, CalcStatus.ONLY_PREVIOUS, "KRW",
                new Evidence(PREV, sjDiv, accountId, name, "제 56 기"), null));
    }

    @Test
    @DisplayName("손익계산서 계정은 같은 손익계산서의 현재 매출액 대비 비율을 소수 6자리로 계산한다")
    void incomeStatementAccountUsesCurrentRevenue() {
        FinancialChange revenue = change("IS", "ifrs-full_Revenue", "매출액", 0, 900L, 1_000L);
        FinancialChange cost = change("IS", "ifrs-full_CostOfSales", "매출원가", 1, 600L, 612L);
        ChangeScales scales = ChangeScales.of(List.of(revenue, cost));

        ChangeScale scale = scales.scaleOf(cost);

        assertThat(scale.base()).isEqualTo(Base.REVENUE);
        assertThat(scale.baseAccountName()).isEqualTo("매출액");
        assertThat(scale.baseAmount()).isEqualTo(1_000L);
        assertThat(scale.ratio()).isEqualByComparingTo("0.012");
        assertThat(scale.ratio().scale()).isEqualTo(6);
        assertThat(scale.reason()).isNull();
        // 기준 계정 자신도 비율이 있다
        assertThat(scales.scaleOf(revenue).ratio()).isEqualByComparingTo("0.1");
    }

    @Test
    @DisplayName("비율은 HALF_UP으로 소수 6자리에서 반올림하고 감소는 음수다")
    void ratioRoundsHalfUpAndKeepsSign() {
        assertThat(ChangeScales.ratio(1, 3)).isEqualTo(new BigDecimal("0.333333"));
        assertThat(ChangeScales.ratio(2, 3)).isEqualTo(new BigDecimal("0.666667"));
        assertThat(ChangeScales.ratio(-1, 8_000_000)).isEqualTo(new BigDecimal("-0.000000"));
        assertThat(ChangeScales.ratio(-5, 1_000_000)).isEqualTo(new BigDecimal("-0.000005"));
    }

    @Test
    @DisplayName("계정 ID가 매출액 표준계정이면 이름이 달라도(영업수익) 기준으로 쓰고, ID가 없으면 이름 '매출액'으로 찾는다")
    void revenueIsFoundByAccountIdThenByName() {
        FinancialChange operatingRevenue = change("IS", "ifrs-full_Revenue", "영업수익", 3, 100L, 200L);
        FinancialChange namedRevenue = change("IS", "-표준계정코드 미사용-", "매출액", 0, 100L, 500L);
        FinancialChange other = change("IS", "dart_X", "기타", 1, 0L, 10L);

        assertThat(ChangeScales.of(List.of(namedRevenue, operatingRevenue, other)).scaleOf(other).baseAccountName())
                .isEqualTo("영업수익");
        assertThat(ChangeScales.of(List.of(namedRevenue, other)).scaleOf(other).baseAmount()).isEqualTo(500L);
    }

    @Test
    @DisplayName("현금흐름표 계정은 손익계산서, 없으면 포괄손익계산서의 매출액을 쓰고 포괄손익계산서 계정은 자기 표를 먼저 본다")
    void flowStatementsLookForRevenueInOrder() {
        FinancialChange isRevenue = change("IS", "ifrs-full_Revenue", "매출액", 0, 100L, 1_000L);
        FinancialChange cisRevenue = change("CIS", "ifrs-full_Revenue", "매출액", 0, 100L, 2_000L);
        FinancialChange cash = change("CF", "ifrs-full_CashFlowsFromUsedInOperatingActivities", "영업활동현금흐름", 0,
                0L, 100L);
        FinancialChange oci = change("CIS", "dart_X", "기타포괄손익", 1, 0L, 100L);

        ChangeScales both = ChangeScales.of(List.of(cisRevenue, isRevenue, cash, oci));
        assertThat(both.scaleOf(cash).baseAmount()).isEqualTo(1_000L);
        assertThat(both.scaleOf(oci).baseAmount()).isEqualTo(2_000L);

        ChangeScales onlyCis = ChangeScales.of(List.of(cisRevenue, cash));
        assertThat(onlyCis.scaleOf(cash).baseAmount()).isEqualTo(2_000L);

        ChangeScales onlyIs = ChangeScales.of(List.of(isRevenue, oci));
        assertThat(onlyIs.scaleOf(oci).baseAmount()).isEqualTo(1_000L);
    }

    @Test
    @DisplayName("재무상태표 계정은 자산총계, 자본변동표 계정은 재무상태표의 자본총계 대비다")
    void balanceSheetUsesTotalAssetsAndEquityStatementUsesTotalEquity() {
        FinancialChange assets = change("BS", "ifrs-full_Assets", "자산총계", 5, 1_000L, 2_000L);
        FinancialChange equity = change("BS", "ifrs-full_Equity", "자본총계", 9, 500L, 800L);
        FinancialChange cash = change("BS", "ifrs-full_Cash", "현금", 0, 100L, 300L);
        FinancialChange dividend = change("SCE", "dart_Dividends", "배당금지급", 0, -10L, -50L);
        ChangeScales scales = ChangeScales.of(List.of(cash, assets, equity, dividend));

        ChangeScale cashScale = scales.scaleOf(cash);
        assertThat(cashScale.base()).isEqualTo(Base.TOTAL_ASSETS);
        assertThat(cashScale.ratio()).isEqualByComparingTo("0.1");

        ChangeScale dividendScale = scales.scaleOf(dividend);
        assertThat(dividendScale.base()).isEqualTo(Base.TOTAL_EQUITY);
        assertThat(dividendScale.baseAccountName()).isEqualTo("자본총계");
        assertThat(dividendScale.ratio()).isEqualByComparingTo("-0.05");
    }

    @Test
    @DisplayName("자본총계는 계정 이름이 달라도 표준계정 ID(ifrs-full_Equity)로 찾는다")
    void totalEquityIsFoundByAccountId() {
        FinancialChange equity = change("BS", "ifrs-full_Equity", "자본 총계", 9, 500L, 1_000L);
        FinancialChange dividend = change("SCE", "dart_Dividends", "배당금지급", 0, -10L, -50L);

        ChangeScale scale = ChangeScales.of(List.of(equity, dividend)).scaleOf(dividend);

        assertThat(scale.baseAccountName()).isEqualTo("자본 총계");
        assertThat(scale.ratio()).isEqualByComparingTo("-0.04");
    }

    @Test
    @DisplayName("기준 계정이 없으면 BASE_NOT_FOUND, 현재 보고서에 값이 없으면 BASE_MISSING이다")
    void missingBaseHasReason() {
        FinancialChange interest = change("IS", "dart_InterestIncome", "이자수익", 0, 100L, 120L);
        ChangeScale notFound = ChangeScales.of(List.of(interest)).scaleOf(interest);
        assertThat(notFound.ratio()).isNull();
        assertThat(notFound.reason()).isEqualTo(Reason.BASE_NOT_FOUND);
        assertThat(notFound.baseAccountName()).isNull();

        // 이전 보고서에만 있는 매출액은 현재 값이 아니라서 기준으로 쓰지 않는다
        FinancialChange oldRevenue = onlyPrevious("IS", "ifrs-full_Revenue", "매출액", 1);
        assertThat(ChangeScales.of(List.of(interest, oldRevenue)).scaleOf(interest).reason())
                .isEqualTo(Reason.BASE_NOT_FOUND);

        FinancialChange emptyRevenue = change("IS", "ifrs-full_Revenue", "매출액", 1, 100L, null);
        ChangeScale missing = ChangeScales.of(List.of(interest, emptyRevenue)).scaleOf(interest);
        assertThat(missing.reason()).isEqualTo(Reason.BASE_MISSING);
        assertThat(missing.baseAccountName()).isEqualTo("매출액");
        assertThat(missing.baseAmount()).isNull();
    }

    @Test
    @DisplayName("기준 값이 0이거나 음수면 BASE_NOT_POSITIVE, 증감액이 없으면 CHANGE_NOT_CALCULATED이다")
    void nonPositiveBaseAndUncalculatedChangeHaveReason() {
        FinancialChange zeroRevenue = change("IS", "ifrs-full_Revenue", "매출액", 0, 100L, 0L);
        FinancialChange cost = change("IS", "ifrs-full_CostOfSales", "매출원가", 1, 10L, 20L);
        assertThat(ChangeScales.of(List.of(zeroRevenue, cost)).scaleOf(cost).reason())
                .isEqualTo(Reason.BASE_NOT_POSITIVE);

        FinancialChange negativeEquity = change("BS", "ifrs-full_Equity", "자본총계", 0, 100L, -5L);
        FinancialChange dividend = change("SCE", "dart_Dividends", "배당금지급", 0, -10L, -50L);
        assertThat(ChangeScales.of(List.of(negativeEquity, dividend)).scaleOf(dividend).reason())
                .isEqualTo(Reason.BASE_NOT_POSITIVE);

        FinancialChange revenue = change("IS", "ifrs-full_Revenue", "매출액", 0, 100L, 1_000L);
        FinancialChange uncalculated = change("IS", "dart_X", "기타", 1, 10L, null);
        ChangeScale scale = ChangeScales.of(List.of(revenue, uncalculated)).scaleOf(uncalculated);
        assertThat(scale.reason()).isEqualTo(Reason.CHANGE_NOT_CALCULATED);
        assertThat(scale.ratio()).isNull();
        assertThat(scale.baseAmount()).isEqualTo(1_000L);
    }

    @Test
    @DisplayName("규모 큰 순은 비율 절댓값 내림차순이고 같으면 받은 순서, 비율이 없으면 맨 뒤에 받은 순서로 둔다")
    void sortByScaleOrdersByAbsoluteRatio() {
        FinancialChange revenue = change("IS", "ifrs-full_Revenue", "매출액", 0, 900L, 1_000L);
        FinancialChange small = change("IS", "a", "작은감소", 1, 30L, 20L);
        FinancialChange missing = change("IS", "b", "값없음", 2, 30L, null);
        FinancialChange big = change("IS", "c", "큰감소", 3, 500L, 200L);
        FinancialChange sameAsSmall = change("IS", "d", "작은증가", 4, 20L, 30L);
        FinancialChange missing2 = change("IS", "e", "값없음2", 5, null, 10L);
        List<FinancialChange> items = List.of(revenue, small, missing, big, sameAsSmall, missing2);

        List<FinancialChange> sorted = ChangeScales.of(items).sortByScale(items);

        assertThat(sorted).extracting(FinancialChange::getAccountName)
                .containsExactly("큰감소", "매출액", "작은감소", "작은증가", "값없음", "값없음2");
        assertThat(items.get(0).getAccountName()).isEqualTo("매출액");
    }
}
