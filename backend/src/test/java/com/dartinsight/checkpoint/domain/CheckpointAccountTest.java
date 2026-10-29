package com.dartinsight.checkpoint.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.dartinsight.financial.domain.FinancialAccount;
import com.dartinsight.financial.domain.FsDiv;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 계정 ID·이름 조합은 저장된 OpenDART 전체 재무제표 실제 응답에서 확인한 것이다(금액은 가짜).
 * 삼성전자 2025 사업보고서(연결) 20260310002820: 매출채권 ifrs-full_CurrentTradeReceivables, 재고자산 ifrs-full_Inventories,
 * 유동성장기부채 ifrs-full_CurrentPortionOfLongtermBorrowings, 영업이익 dart_OperatingIncomeLoss(IS), 매출액 ifrs-full_Revenue(IS),
 * 영업활동현금흐름 ifrs-full_CashFlowsFromUsedInOperatingActivities, 단기차입금은 표준계정 미사용.
 * 삼성전자 2015 사업보고서 20160330003536: 옛 ID(ifrs_Revenue '수익(매출액)', ifrs_Equity는 자본변동표 '기말자본'에도 있음).
 */
class CheckpointAccountTest {

    private static final String RCEPT_NO = "20260310002820";

    private static FinancialAccount account(String sjDiv, String accountId, String name, int ord, Long amount) {
        return FinancialAccount.create(1L, RCEPT_NO, sjDiv, null, accountId, name, null, ord, "KRW", "제 57 기",
                "제 56 기", amount, null, null, null, null);
    }

    @Test
    @DisplayName("표준계정 ID로 먼저 찾고, ID가 없으면 공백을 뺀 계정명으로 찾는다")
    void findsByIdThenByName() {
        List<FinancialAccount> accounts = List.of(
                account("BS", "ifrs-full_CurrentTradeReceivables", "매출채권", 14, 10L),
                account("BS", FinancialAccount.NON_STANDARD_ACCOUNT_ID, "단기 차입금", 40, 7L),
                account("BS", "ifrs-full_CurrentPortionOfLongtermBorrowings", "유동성장기부채", 45, 3L));
        assertThat(CheckpointAccount.TRADE_RECEIVABLES.find(accounts)).get()
                .extracting(FinancialAccount::getThstrmAmount).isEqualTo(10L);
        assertThat(CheckpointAccount.SHORT_TERM_BORROWINGS.find(accounts)).get()
                .extracting(FinancialAccount::getThstrmAmount).isEqualTo(7L);
        assertThat(CheckpointAccount.CURRENT_PORTION_OF_LONG_TERM_BORROWINGS.find(accounts)).isPresent();
        assertThat(CheckpointAccount.INVENTORIES.find(accounts)).isEmpty();
    }

    @Test
    @DisplayName("다른 채권이 함께 든 '매출채권및기타채권'은 매출채권으로 보지 않는다")
    void doesNotTreatTradeAndOtherReceivablesAsTradeReceivables() {
        List<FinancialAccount> accounts = List.of(account("BS", "-표준계정코드 미사용-", "매출채권및기타채권", 5, 10L));
        assertThat(CheckpointAccount.TRADE_RECEIVABLES.find(accounts)).isEmpty();
    }

    @Test
    @DisplayName("손익계산서에 없으면 포괄손익계산서에서 매출·영업이익을 찾는다")
    void fallsBackToComprehensiveIncomeStatement() {
        List<FinancialAccount> accounts = List.of(
                account("CIS", "ifrs-full_Revenue", "영업수익", 1, 100L),
                account("CIS", "ifrs-full_ProfitLossFromOperatingActivities", "영업이익", 5, 9L));
        assertThat(CheckpointAccount.REVENUE.find(accounts)).isPresent();
        assertThat(CheckpointAccount.OPERATING_INCOME.find(accounts)).get()
                .extracting(FinancialAccount::getThstrmAmount).isEqualTo(9L);
    }

    @Test
    @DisplayName("자본총계는 재무상태표에서만 찾는다(자본변동표 '기말자본'과 섞지 않음)")
    void equityOnlyFromBalanceSheet() {
        List<FinancialAccount> accounts = List.of(account("SCE", "ifrs_Equity", "기말자본", 1, 1L));
        assertThat(CheckpointAccount.TOTAL_EQUITY.find(accounts)).isEmpty();
        YearAccounts year = YearAccounts.of(List.of(account("BS", "ifrs_Equity", "자본총계", 30, 50L),
                account("SCE", "ifrs_Equity", "기말자본", 1, 1L)), FsDiv.CFS);
        assertThat(year.amount(CheckpointAccount.TOTAL_EQUITY)).isEqualTo(50L);
        assertThat(year.value(CheckpointAccount.TOTAL_EQUITY).evidence().statementName()).isEqualTo("재무상태표");
        assertThat(year.value(CheckpointAccount.TOTAL_EQUITY).evidence().rceptNo()).isEqualTo(RCEPT_NO);
    }

    @Test
    @DisplayName("같은 조건의 계정이 여럿이면 원문 순서가 앞선 계정을 쓴다")
    void prefersEarlierOrd() {
        List<FinancialAccount> accounts = List.of(
                account("CF", "ifrs-full_CashFlowsFromUsedInOperatingActivities", "영업활동현금흐름", 37, 1L),
                account("CF", "ifrs-full_CashFlowsFromUsedInOperatingActivities", "영업활동현금흐름", 2, 2L));
        assertThat(CheckpointAccount.OPERATING_CASH_FLOW.find(accounts)).get()
                .extracting(FinancialAccount::getThstrmAmount).isEqualTo(2L);
    }
}
