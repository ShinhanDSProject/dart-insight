package com.dartinsight.analysis.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.dartinsight.analysis.domain.FinancialComparator.Side;
import com.dartinsight.comparison.domain.AmountBasis;
import com.dartinsight.comparison.domain.StatementRules;
import com.dartinsight.financial.domain.FinancialAccount;
import com.dartinsight.financial.domain.FsDiv;
import com.dartinsight.report.domain.ReportType;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class FinancialComparatorTest {

    private static final String PREV = "20250814000001";
    private static final String CUR = "20260814000001";

    /** 가짜 계정. 금액 순서: 당기, 당기 누적 */
    private static FinancialAccount account(String rceptNo, String sjDiv, String accountId, String name, int ord,
            Long thstrm, Long thstrmAdd) {
        return FinancialAccount.create(1L, rceptNo, sjDiv, null, accountId, name, null, ord, "KRW",
                rceptNo.equals(CUR) ? "제 10 기 반기" : "제 9 기 반기", null, thstrm, thstrmAdd, null, null, null);
    }

    private static FinancialAccount sce(String rceptNo, String accountId, String detail, int ord, Long thstrm) {
        return FinancialAccount.create(1L, rceptNo, "SCE", null, accountId, "기말자본", detail, ord, "KRW", null, null,
                thstrm, null, null, null, null);
    }

    private static FinancialAccount sceNamed(String rceptNo, String name, int ord, Long thstrm) {
        return FinancialAccount.create(1L, rceptNo, "SCE", null, "ifrs-full_Equity", name, null, ord, "KRW", null, null,
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
    @DisplayName("2024 사업보고서(연결) 실제 값으로 흑자전환·적자전환·적자폭 축소와 이익이 아닌 계정의 부호 변화를 가른다")
    void signChangesOfRealAnnualReportsFollowTheTable() {
        // 금액은 OpenDART fnlttSinglAcntAll(2024, 11011, CFS)의 전기·당기 금액
        record Case(String company, String rceptNo, String accountId, long previous, long current, CalcStatus expected) {
        }
        List<Case> cases = List.of(
                new Case("SK하이닉스", "20250319000665", "dart_OperatingIncomeLoss", -7_730_313_000_000L,
                        23_467_319_000_000L, CalcStatus.TURNED_PROFIT),
                new Case("LG디스플레이", "20250312000906", "dart_OperatingIncomeLoss", -2_510_164_000_000L,
                        -560_596_000_000L, CalcStatus.LOSS_NARROWED),
                new Case("LG디스플레이", "20250312000906", "ifrs-full_ProfitLoss", -2_576_729_000_000L,
                        -2_409_300_000_000L, CalcStatus.LOSS_NARROWED),
                new Case("카카오", "20250324000901", "ifrs-full_ProfitLoss", -1_816_669_011_014L,
                        -161_870_567_171L, CalcStatus.LOSS_NARROWED),
                new Case("카카오", "20250324000901", "ifrs-full_ProfitLossAttributableToOwnersOfParent",
                        -1_012_550_566_010L, 55_277_416_537L, CalcStatus.TURNED_PROFIT),
                new Case("에코프로비엠", "20250325000761", "dart_OperatingIncomeLoss", 156_029_935_394L,
                        -34_109_364_109L, CalcStatus.TURNED_LOSS),
                new Case("삼성전자", "20250311001085", "ifrs-full_IncomeTaxExpenseContinuingOperations",
                        -4_480_835_000_000L, 3_078_383_000_000L, CalcStatus.SIGN_CHANGED),
                new Case("삼성전자", "20250311001085", "ifrs-full_GainsLossesOnCashFlowHedgesNetOfTax", 927_000_000L,
                        -38_946_000_000L, CalcStatus.SIGN_CHANGED));
        for (Case c : cases) {
            List<FinancialChangeRow> rows = compare(ReportType.HALF, ReportType.HALF,
                    List.of(account(PREV, "CIS", c.accountId(), "계정", 1, c.previous(), c.previous())),
                    List.of(account(CUR, "CIS", c.accountId(), "계정", 1, c.current(), c.current())));

            FinancialChangeRow row = find(rows, "CIS", c.accountId());
            assertThat(row.calcStatus()).as(c.company() + " " + c.rceptNo() + " " + c.accountId())
                    .isEqualTo(c.expected());
            assertThat(row.changeAmount()).isEqualTo(c.current() - c.previous());
            assertThat(row.changeRate()).as("부호가 바뀌거나 이전 값이 음수면 증감률이 없다").isNull();
        }
    }

    @Test
    @DisplayName("0 경계와 같은 손실, 적자폭 확대를 판정표대로 가른다")
    void zeroBoundariesAndLossesFollowTheTable() {
        assertThat(FinancialComparator.status(0, -5, true)).isEqualTo(CalcStatus.PREVIOUS_ZERO);
        assertThat(FinancialComparator.status(0, 5, false)).isEqualTo(CalcStatus.PREVIOUS_ZERO);
        assertThat(FinancialComparator.status(10, 0, true)).isEqualTo(CalcStatus.OK);
        assertThat(FinancialComparator.status(-10, 0, true)).isEqualTo(CalcStatus.LOSS_NARROWED);
        assertThat(FinancialComparator.status(-10, 0, false)).isEqualTo(CalcStatus.PREVIOUS_NEGATIVE);
        assertThat(FinancialComparator.status(-10, -10, true)).isEqualTo(CalcStatus.PREVIOUS_NEGATIVE);
        assertThat(FinancialComparator.status(-10, -30, true)).isEqualTo(CalcStatus.LOSS_WIDENED);
        assertThat(FinancialComparator.status(-10, -30, false)).isEqualTo(CalcStatus.PREVIOUS_NEGATIVE);
        assertThat(FinancialComparator.status(10, -30, false)).isEqualTo(CalcStatus.SIGN_CHANGED);
    }

    @Test
    @DisplayName("흑자·적자는 손익계산서의 목록에 있는 표준계정에만 쓴다(자본변동표·회사 고유 계정은 중립)")
    void profitStatesAreOnlyForListedIncomeStatementAccounts() {
        List<FinancialChangeRow> rows = compare(ReportType.HALF, ReportType.HALF,
                List.of(account(PREV, "IS", "dart_OperatingIncomeLoss", "영업이익", 1, -10L, -10L),
                        account(PREV, "IS", "-표준계정코드 미사용-", "회사이익", 2, -10L, -10L),
                        sce(PREV, "ifrs-full_ProfitLoss", "이익잉여금", 1, 34_270_000_000L)),
                List.of(account(CUR, "IS", "dart_OperatingIncomeLoss", "영업이익", 1, 20L, 20L),
                        account(CUR, "IS", "-표준계정코드 미사용-", "회사이익", 2, 20L, 20L),
                        sce(CUR, "ifrs-full_ProfitLoss", "이익잉여금", 1, -450_000_000L)));

        assertThat(find(rows, "IS", "dart_OperatingIncomeLoss").calcStatus()).isEqualTo(CalcStatus.TURNED_PROFIT);
        assertThat(rows.stream().filter(r -> r.accountName().equals("회사이익")).findFirst().orElseThrow()
                .calcStatus()).isEqualTo(CalcStatus.SIGN_CHANGED);
        assertThat(rows.stream().filter(r -> r.sjDiv().equals("SCE")).findFirst().orElseThrow().calcStatus())
                .as("에코프로비엠 SCE '반기손이익(손실)'처럼 자본변동표는 이익 계정이 아니다")
                .isEqualTo(CalcStatus.SIGN_CHANGED);
        assertThat(CalcStatus.SIGN_CHANGED.message()).isEqualTo("부호가 바뀌어 증감률을 계산하지 않아요.");
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
        // 같은 계정명을 화면에서 구분하도록 원래 계정 상세(공백 그대로)를 결과에 남긴다(#401)
        assertThat(find(rows, "SCE", "ifrs-full_Equity|이익잉여금[member]").accountDetail()).isEqualTo("이익잉여금 [member]");
    }

    @Test
    void onlyEquityChangesKeepAccountDetail() {
        List<FinancialChangeRow> rows = compare(ReportType.HALF, ReportType.HALF,
                List.of(account(PREV, "IS", "rev", "매출액", 1, 30L, 55L)),
                List.of(account(CUR, "IS", "rev", "매출액", 1, 40L, 70L)));

        assertThat(rows).extracting(FinancialChangeRow::accountDetail).containsOnlyNulls();
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

    @Test
    @DisplayName("계정 ID가 해마다 바뀌어도 이름이 같으면 한 행으로 짝짓는다(삼성전자 2025.06 → 2026.06)")
    void accountsWhoseIdChangedArePairedByName() {
        String nonStandard = FinancialAccount.NON_STANDARD_ACCOUNT_ID;
        List<FinancialChangeRow> rows = compare(ReportType.HALF, ReportType.HALF,
                List.of(account(PREV, "BS", "ifrs-full_PropertyPlantAndEquipment", "유형자산", 1, 205L, null),
                        account(PREV, "BS", nonStandard, "단기차입금", 2, 7L, null)),
                List.of(account(CUR, "BS", "ifrs-full_PropertyPlantAndEquipmentIncludingRightofuseAssets", "유형자산", 1,
                                224L, null),
                        account(CUR, "BS", "dart_CurrentLoansReceived", "단기차입금", 2, 13L, null)));

        assertThat(rows).hasSize(2);
        FinancialChangeRow ppe = find(rows, "BS", "NAME:유형자산");
        assertThat(ppe.calcStatus()).isEqualTo(CalcStatus.OK);
        assertThat(ppe.changeAmount()).isEqualTo(19L);
        assertThat(ppe.previous().accountId()).isEqualTo("ifrs-full_PropertyPlantAndEquipment");
        assertThat(ppe.current().accountId()).isEqualTo("ifrs-full_PropertyPlantAndEquipmentIncludingRightofuseAssets");
        FinancialChangeRow loans = find(rows, "BS", "NAME:단기차입금");
        assertThat(loans.calcStatus()).isEqualTo(CalcStatus.OK);
        assertThat(loans.changeAmount()).isEqualTo(6L);
        assertThat(rows).extracting(FinancialChangeRow::displayOrder).containsExactly(0, 1);
    }

    @Test
    @DisplayName("한쪽에만 남은 같은 이름 계정이 여러 개면 이름으로 짝짓지 않는다")
    void sameNameLeftoversAreNotPairedWhenNotUnique() {
        List<FinancialChangeRow> rows = compare(ReportType.HALF, ReportType.HALF,
                List.of(account(PREV, "BS", "old", "기타자산", 1, 1L, null)),
                List.of(account(CUR, "BS", "new1", "기타자산", 1, 2L, null),
                        account(CUR, "BS", "new2", "기타자산", 2, 3L, null)));

        assertThat(rows).extracting(FinancialChangeRow::calcStatus)
                .containsExactly(CalcStatus.ONLY_CURRENT, CalcStatus.ONLY_CURRENT, CalcStatus.ONLY_PREVIOUS);
    }

    @Test
    @DisplayName("키로 이미 짝지은 계정은 이름 짝짓기에 쓰지 않는다")
    void keyMatchedAccountsAreNotReusedByName() {
        List<FinancialChangeRow> rows = compare(ReportType.HALF, ReportType.HALF,
                List.of(account(PREV, "BS", "a", "자산", 1, 1L, null), account(PREV, "BS", "b", "부채", 2, 5L, null)),
                List.of(account(CUR, "BS", "a", "자산", 1, 2L, null), account(CUR, "BS", "c", "자산", 2, 3L, null)));

        assertThat(find(rows, "BS", "a").calcStatus()).isEqualTo(CalcStatus.OK);
        assertThat(find(rows, "BS", "c").calcStatus()).isEqualTo(CalcStatus.ONLY_CURRENT);
        assertThat(find(rows, "BS", "b").calcStatus()).isEqualTo(CalcStatus.ONLY_PREVIOUS);
    }

    @Test
    @DisplayName("이전·현재 값이 모두 없는 계정은 결과에서 빼고 화면 순서를 이어 붙인다(#355)")
    void accountsWithoutAnyValueAreLeftOut() {
        List<FinancialChangeRow> rows = compare(ReportType.ANNUAL, ReportType.ANNUAL,
                List.of(account(PREV, "BS", "a", "자산총계", 1, 10L, null),
                        account(PREV, "BS", "both", "양쪽 빈 값", 2, null, null),
                        account(PREV, "BS", "prevOnly", "파생상품자산", 3, null, null)),
                List.of(account(CUR, "BS", "a", "자산총계", 1, 12L, null),
                        account(CUR, "BS", "both", "양쪽 빈 값", 2, null, null),
                        account(CUR, "BS", "curOnly", "관계기업투자주식", 3, null, null),
                        account(CUR, "BS", "c", "부채총계", 4, 5L, null)));

        assertThat(rows).extracting(FinancialChangeRow::accountKey).containsExactly("a", "c");
        assertThat(rows).extracting(FinancialChangeRow::displayOrder).containsExactly(0, 1);
    }

    @Test
    @DisplayName("한쪽 값만 없는 계정은 남기고, 0은 없는 값과 구분한다")
    void oneMissingValueOrZeroIsKept() {
        List<FinancialChangeRow> rows = compare(ReportType.ANNUAL, ReportType.ANNUAL,
                List.of(account(PREV, "BS", "curNull", "현재 없음", 1, 7L, null),
                        account(PREV, "BS", "prevNull", "이전 없음", 2, null, null),
                        account(PREV, "BS", "zeroNull", "이전 0 현재 없음", 3, 0L, null),
                        account(PREV, "BS", "zeros", "둘 다 0", 4, 0L, null),
                        account(PREV, "BS", "prevOnly", "이전에만", 5, 0L, null)),
                List.of(account(CUR, "BS", "curNull", "현재 없음", 1, null, null),
                        account(CUR, "BS", "prevNull", "이전 없음", 2, 3L, null),
                        account(CUR, "BS", "zeroNull", "이전 0 현재 없음", 3, null, null),
                        account(CUR, "BS", "zeros", "둘 다 0", 4, 0L, null),
                        account(CUR, "BS", "curOnly", "현재에만", 5, 4L, null)));

        assertThat(find(rows, "BS", "curNull").calcStatus()).isEqualTo(CalcStatus.CURRENT_MISSING);
        assertThat(find(rows, "BS", "prevNull").calcStatus()).isEqualTo(CalcStatus.PREVIOUS_MISSING);
        FinancialChangeRow zeroNull = find(rows, "BS", "zeroNull");
        assertThat(zeroNull.calcStatus()).isEqualTo(CalcStatus.CURRENT_MISSING);
        assertThat(zeroNull.previousAmount()).isZero();
        FinancialChangeRow zeros = find(rows, "BS", "zeros");
        assertThat(zeros.calcStatus()).isEqualTo(CalcStatus.PREVIOUS_ZERO);
        assertThat(zeros.changeAmount()).isZero();
        assertThat(find(rows, "BS", "curOnly").calcStatus()).isEqualTo(CalcStatus.ONLY_CURRENT);
        FinancialChangeRow prevOnly = find(rows, "BS", "prevOnly");
        assertThat(prevOnly.calcStatus()).isEqualTo(CalcStatus.ONLY_PREVIOUS);
        assertThat(prevOnly.previousAmount()).as("0은 없는 값이 아니다").isZero();
    }

    @Test
    @DisplayName("기간이 달라 비교하지 않는 재무제표의 계정은 값이 없어도 남긴다")
    void periodMismatchRowsAreKept() {
        List<FinancialChangeRow> rows = compare(ReportType.Q1, ReportType.HALF,
                List.of(account(PREV, "CF", "cash", "영업활동현금흐름", 1, null, null)),
                List.of(account(CUR, "CF", "cash", "영업활동현금흐름", 1, null, null)));

        assertThat(find(rows, "CF", "cash").calcStatus()).isEqualTo(CalcStatus.PERIOD_MISMATCH);
    }
}
