package com.dartinsight.analysis;

import static org.assertj.core.api.Assertions.assertThat;

import com.dartinsight.analysis.FinancialComparator.Side;
import com.dartinsight.comparison.AmountBasis;
import com.dartinsight.comparison.StatementRules;
import com.dartinsight.financial.FinancialAccount;
import com.dartinsight.financial.FsDiv;
import com.dartinsight.report.ReportType;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class FinancialComparatorTest {

    private static final String PREV = "20250814000001";
    private static final String CUR = "20260814000001";

    /** 가짜 계정. 금액 순서: 당기, 당기 누적 */
    private static FinancialAccount account(String rceptNo, String sjDiv, String accountId, String name, int ord,
            Long thstrm, Long thstrmAdd) {
        return new FinancialAccount(1L, rceptNo, sjDiv, null, accountId, name, null, ord, "KRW",
                rceptNo.equals(CUR) ? "제 10 기 반기" : "제 9 기 반기", null, thstrm, thstrmAdd, null, null, null);
    }

    private static FinancialAccount sce(String rceptNo, String accountId, String detail, int ord, Long thstrm) {
        return new FinancialAccount(1L, rceptNo, "SCE", null, accountId, "기말자본", detail, ord, "KRW", null, null,
                thstrm, null, null, null, null);
    }

    private static FinancialAccount sceNamed(String rceptNo, String name, int ord, Long thstrm) {
        return new FinancialAccount(1L, rceptNo, "SCE", null, "ifrs-full_Equity", name, null, ord, "KRW", null, null,
                thstrm, null, null, null, null);
    }

    private static List<FinancialChangeRow> compare(ReportType prevType, ReportType curType,
            List<FinancialAccount> prev, List<FinancialAccount> cur) {
        return FinancialComparator.compare(FsDiv.CFS, StatementRules.rules(prevType, curType),
                new Side(prevType, prev), new Side(curType, cur));
    }

    private static FinancialChangeRow find(List<FinancialChangeRow> rows, String sjDiv, String key) {
        return rows.stream().filter(r -> r.sjDiv().equals(sjDiv) && r.accountKey().equals(key)).findFirst()
                .orElseThrow();
    }

    @Test
    void calculatesChangeAndRateWithEvidence() {
        List<FinancialChangeRow> rows = compare(ReportType.HALF, ReportType.HALF,
                List.of(account(PREV, "BS", "ifrs-full_Assets", "자산총계", 1, 1_000L, null)),
                List.of(account(CUR, "BS", "ifrs-full_Assets", "자산총계", 1, 1_153L, null)));

        FinancialChangeRow assets = find(rows, "BS", "ifrs-full_Assets");
        assertThat(assets.calcStatus()).isEqualTo(CalcStatus.OK);
        assertThat(assets.amountBasis()).isEqualTo(AmountBasis.POINT);
        assertThat(assets.previousAmount()).isEqualTo(1_000L);
        assertThat(assets.currentAmount()).isEqualTo(1_153L);
        assertThat(assets.changeAmount()).isEqualTo(153L);
        assertThat(assets.changeRate()).isEqualByComparingTo(new BigDecimal("0.153000"));
        assertThat(assets.direction()).isEqualTo("UP");
        assertThat(assets.fsDiv()).isEqualTo(FsDiv.CFS);
        assertThat(assets.currency()).isEqualTo("KRW");
        assertThat(assets.previous().rceptNo()).isEqualTo(PREV);
        assertThat(assets.previous().accountId()).isEqualTo("ifrs-full_Assets");
        assertThat(assets.previous().periodName()).isEqualTo("제 9 기 반기");
        assertThat(assets.current().rceptNo()).isEqualTo(CUR);
        assertThat(assets.current().sjDiv()).isEqualTo("BS");
    }

    @Test
    void rateIsRoundedToSixDecimals() {
        List<FinancialChangeRow> rows = compare(ReportType.HALF, ReportType.HALF,
                List.of(account(PREV, "BS", "a", "A", 1, 3L, null)),
                List.of(account(CUR, "BS", "a", "A", 1, 4L, null)));

        assertThat(find(rows, "BS", "a").changeRate()).isEqualByComparingTo(new BigDecimal("0.333333"));
    }

    @Test
    void zeroNegativeAndMissingValuesAreNotTreatedAsZero() {
        List<FinancialChangeRow> rows = compare(ReportType.HALF, ReportType.HALF,
                List.of(
                        account(PREV, "BS", "zero", "영", 1, 0L, null),
                        account(PREV, "BS", "neg", "음수", 2, -100L, null),
                        account(PREV, "BS", "prevNull", "이전 없음", 3, null, null),
                        account(PREV, "BS", "curNull", "현재 없음", 4, 10L, null),
                        account(PREV, "BS", "gone", "사라진 계정", 5, 10L, null)),
                List.of(
                        account(CUR, "BS", "zero", "영", 1, 50L, null),
                        account(CUR, "BS", "neg", "음수", 2, -50L, null),
                        account(CUR, "BS", "prevNull", "이전 없음", 3, 7L, null),
                        account(CUR, "BS", "curNull", "현재 없음", 4, null, null),
                        account(CUR, "BS", "new", "새 계정", 5, 9L, null)));

        FinancialChangeRow zero = find(rows, "BS", "zero");
        assertThat(zero.calcStatus()).isEqualTo(CalcStatus.PREVIOUS_ZERO);
        assertThat(zero.changeAmount()).isEqualTo(50L);
        assertThat(zero.changeRate()).isNull();
        FinancialChangeRow negative = find(rows, "BS", "neg");
        assertThat(negative.calcStatus()).isEqualTo(CalcStatus.PREVIOUS_NEGATIVE);
        assertThat(negative.changeAmount()).isEqualTo(50L);
        assertThat(negative.changeRate()).isNull();
        FinancialChangeRow prevNull = find(rows, "BS", "prevNull");
        assertThat(prevNull.calcStatus()).isEqualTo(CalcStatus.PREVIOUS_MISSING);
        assertThat(prevNull.previousAmount()).isNull();
        assertThat(prevNull.changeAmount()).isNull();
        assertThat(prevNull.direction()).isNull();
        assertThat(find(rows, "BS", "curNull").calcStatus()).isEqualTo(CalcStatus.CURRENT_MISSING);
        FinancialChangeRow added = find(rows, "BS", "new");
        assertThat(added.calcStatus()).isEqualTo(CalcStatus.ONLY_CURRENT);
        assertThat(added.previous()).isNull();
        assertThat(added.currentAmount()).isEqualTo(9L);
        FinancialChangeRow removed = find(rows, "BS", "gone");
        assertThat(removed.calcStatus()).isEqualTo(CalcStatus.ONLY_PREVIOUS);
        assertThat(removed.current()).isNull();
        assertThat(CalcStatus.PREVIOUS_ZERO.message()).isNotBlank();
        assertThat(CalcStatus.OK.message()).isNull();
    }

    @Test
    void keepsCurrentOrderAndPutsRemovedAccountsAfter() {
        List<FinancialChangeRow> rows = compare(ReportType.HALF, ReportType.HALF,
                List.of(account(PREV, "BS", "b", "B", 1, 1L, null), account(PREV, "BS", "gone", "G", 2, 1L, null)),
                List.of(account(CUR, "BS", "a", "A", 2, 1L, null), account(CUR, "BS", "b", "B", 1, 1L, null)));

        assertThat(rows).filteredOn(r -> r.sjDiv().equals("BS"))
                .extracting(FinancialChangeRow::accountKey).containsExactly("b", "a", "gone");
        assertThat(rows).extracting(FinancialChangeRow::displayOrder).containsExactly(0, 1, 2);
    }

    @Test
    void nonStandardAccountsAreMatchedByNormalizedName() {
        String nonStandard = FinancialAccount.NON_STANDARD_ACCOUNT_ID;
        List<FinancialChangeRow> rows = compare(ReportType.HALF, ReportType.HALF,
                List.of(account(PREV, "BS", nonStandard, "기타 금융 자산", 1, 10L, null)),
                List.of(account(CUR, "BS", nonStandard, "기타금융자산", 1, 12L, null),
                        account(CUR, "BS", nonStandard, "기타 비금융자산", 2, 3L, null)));

        assertThat(find(rows, "BS", "NAME:기타금융자산").calcStatus()).isEqualTo(CalcStatus.OK);
        assertThat(find(rows, "BS", "NAME:기타비금융자산").calcStatus()).isEqualTo(CalcStatus.ONLY_CURRENT);
    }

    @Test
    void repeatedKeysAreMatchedInOrder() {
        List<FinancialChangeRow> rows = compare(ReportType.HALF, ReportType.HALF,
                List.of(account(PREV, "CF", "x", "X", 1, 1L, null), account(PREV, "CF", "x", "X", 2, 2L, null)),
                List.of(account(CUR, "CF", "x", "X", 1, 3L, null), account(CUR, "CF", "x", "X", 2, 5L, null)));

        assertThat(find(rows, "CF", "x|x").changeAmount()).isEqualTo(2L);
        assertThat(find(rows, "CF", "x|x#2").changeAmount()).isEqualTo(3L);
    }

    @Test
    void repeatedAccountsWithDifferentNamesAreMatchedByName() {
        List<FinancialChangeRow> rows = compare(ReportType.HALF, ReportType.HALF,
                List.of(sceNamed(PREV, "기초자본", 1, 100L), sceNamed(PREV, "기말자본", 2, 120L)),
                List.of(sceNamed(CUR, "기초자본", 1, 120L), sceNamed(CUR, "기말자본", 2, 150L)));

        assertThat(find(rows, "SCE", "ifrs-full_Equity|기초자본").changeAmount()).isEqualTo(20L);
        assertThat(find(rows, "SCE", "ifrs-full_Equity|기말자본").changeAmount()).isEqualTo(30L);
    }

    @Test
    void sameNamedAccountsWithDifferentCountsAreNotPaired() {
        String nonStandard = FinancialAccount.NON_STANDARD_ACCOUNT_ID;
        List<FinancialChangeRow> rows = compare(ReportType.HALF, ReportType.HALF,
                List.of(account(PREV, "BS", nonStandard, "리스부채", 1, 100L, null)),
                List.of(account(CUR, "BS", nonStandard, "리스부채", 1, 30L, null),
                        account(CUR, "BS", nonStandard, "리스부채", 2, 90L, null)));

        assertThat(rows).hasSize(3).allSatisfy(row -> {
            assertThat(row.calcStatus()).isEqualTo(CalcStatus.AMBIGUOUS_MATCH);
            assertThat(row.changeAmount()).as("어느 것과 짝인지 모르면 계산하지 않는다").isNull();
            assertThat(row.previous() == null || row.current() == null).isTrue();
        });
        assertThat(rows).extracting(FinancialChangeRow::currentAmount).containsExactly(30L, 90L, null);
        assertThat(rows).extracting(FinancialChangeRow::previousAmount).containsExactly(null, null, 100L);
        assertThat(CalcStatus.AMBIGUOUS_MATCH.message()).isNotBlank();
    }

    @Test
    void equityChangesAreMatchedWithDetail() {
        List<FinancialChangeRow> rows = compare(ReportType.HALF, ReportType.HALF,
                List.of(sce(PREV, "ifrs-full_Equity", "이익잉여금 [member]", 1, 100L),
                        sce(PREV, "ifrs-full_Equity", "자본금 [member]", 2, 50L)),
                List.of(sce(CUR, "ifrs-full_Equity", "이익잉여금 [member]", 1, 120L),
                        sce(CUR, "ifrs-full_Equity", "자본금 [member]", 2, 50L)));

        assertThat(find(rows, "SCE", "ifrs-full_Equity|이익잉여금[member]").changeAmount()).isEqualTo(20L);
        assertThat(find(rows, "SCE", "ifrs-full_Equity|자본금[member]").direction()).isEqualTo("SAME");
    }

    @Test
    void sameKindIncomeUsesCumulativeAmount() {
        List<FinancialChangeRow> rows = compare(ReportType.HALF, ReportType.HALF,
                List.of(account(PREV, "IS", "rev", "매출액", 1, 30L, 55L)),
                List.of(account(CUR, "IS", "rev", "매출액", 1, 40L, 70L)));

        FinancialChangeRow revenue = find(rows, "IS", "rev");
        assertThat(revenue.amountBasis()).isEqualTo(AmountBasis.CUMULATIVE);
        assertThat(revenue.previousAmount()).isEqualTo(55L);
        assertThat(revenue.currentAmount()).isEqualTo(70L);
    }

    @Test
    void differentInterimIncomeUsesQuarterAmountAndCashFlowIsNotCompared() {
        List<FinancialChangeRow> rows = compare(ReportType.Q1, ReportType.HALF,
                List.of(account(PREV, "IS", "rev", "매출액", 1, 30L, 30L),
                        account(PREV, "CF", "cash", "영업활동현금흐름", 1, 5L, null)),
                List.of(account(CUR, "IS", "rev", "매출액", 1, 40L, 70L),
                        account(CUR, "CF", "cash", "영업활동현금흐름", 1, 9L, null)));

        FinancialChangeRow revenue = find(rows, "IS", "rev");
        assertThat(revenue.amountBasis()).isEqualTo(AmountBasis.QUARTER);
        assertThat(revenue.previousAmount()).isEqualTo(30L);
        assertThat(revenue.currentAmount()).isEqualTo(40L);
        FinancialChangeRow cash = find(rows, "CF", "cash");
        assertThat(cash.calcStatus()).isEqualTo(CalcStatus.PERIOD_MISMATCH);
        assertThat(cash.previousAmount()).as("기간이 다른 값을 나란히 두지 않는다").isNull();
        assertThat(cash.currentAmount()).isNull();
        assertThat(cash.amountBasis()).isNull();
    }

    @Test
    void annualAndFirstQuarterCumulativeAmounts() {
        assertThat(compare(ReportType.ANNUAL, ReportType.ANNUAL,
                List.of(account(PREV, "IS", "rev", "매출액", 1, 100L, null)),
                List.of(account(CUR, "IS", "rev", "매출액", 1, 120L, null)))
                .getFirst().calcStatus()).isEqualTo(CalcStatus.OK);
        assertThat(find(compare(ReportType.Q1, ReportType.Q1,
                        List.of(account(PREV, "IS", "rev", "매출액", 1, 30L, null)),
                        List.of(account(CUR, "IS", "rev", "매출액", 1, 33L, null))), "IS", "rev")
                .changeAmount()).as("1분기는 누적 금액이 없으면 당기 금액이 곧 누적").isEqualTo(3L);
        assertThat(find(compare(ReportType.HALF, ReportType.HALF,
                        List.of(account(PREV, "IS", "rev", "매출액", 1, 30L, null)),
                        List.of(account(CUR, "IS", "rev", "매출액", 1, 33L, 60L))), "IS", "rev")
                .calcStatus()).as("반기 누적이 없으면 3개월 값으로 대신하지 않는다").isEqualTo(CalcStatus.PREVIOUS_MISSING);
    }
}
