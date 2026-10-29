package com.dartinsight.summary.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.dartinsight.financial.domain.FinancialAccount;
import java.util.Arrays;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 투자자 관점 규칙(FS-64). 계정 이름은 AccountAliasesTest의 2024 사업보고서(삼성전자 20250311001085, LG디스플레이
 * 20250312000906, 카카오 20250324000901, SK하이닉스 20250319000665, 신한지주 20250318000993)에서 확인한 이름이고,
 * 섹션 경로는 docs/verification/3.6-related-accuracy/precision.csv의 실제 사업보고서 목차다.
 */
class SummaryLensTest {

    @Test
    @DisplayName("손익계산서의 매출 계정은 성장, 이익·비용 계정은 수익성으로 묶는다")
    void incomeStatementSplitsRevenueAndProfit() {
        assertThat(SummaryLens.ofFinancial("IS", "ifrs-full_Revenue", "매출액")).isEqualTo(SummaryLens.GROWTH);
        // 표준계정 ID가 없어도(회사 고유 계정) 확인한 매출 계정 이름이면 성장
        assertThat(SummaryLens.ofFinancial("IS", FinancialAccount.NON_STANDARD_ACCOUNT_ID, "매출")).isEqualTo(SummaryLens.GROWTH);
        assertThat(SummaryLens.ofFinancial("CIS", null, "영업수익")).isEqualTo(SummaryLens.GROWTH);
        assertThat(SummaryLens.ofFinancial("IS", "dart_OperatingIncomeLoss", "영업이익(손실)"))
                .isEqualTo(SummaryLens.PROFITABILITY);
        assertThat(SummaryLens.ofFinancial("IS", "ifrs-full_ProfitLoss", "당기순이익(손실)"))
                .isEqualTo(SummaryLens.PROFITABILITY);
        assertThat(SummaryLens.ofFinancial("IS", "ifrs-full_CostOfSales", "매출원가")).isEqualTo(SummaryLens.PROFITABILITY);
        assertThat(SummaryLens.ofFinancial("IS", "ifrs-full_GrossProfit", "매출총이익"))
                .isEqualTo(SummaryLens.PROFITABILITY);
        assertThat(SummaryLens.ofFinancial("IS", null, "판매비와 관리비")).isEqualTo(SummaryLens.PROFITABILITY);
        assertThat(SummaryLens.ofFinancial("IS", "ifrs-full_IncomeTaxExpenseContinuingOperations", "법인세비용"))
                .isEqualTo(SummaryLens.PROFITABILITY);
    }

    @Test
    @DisplayName("재무상태표의 자산·부채·자본·차입 계정은 재무 안정성으로 묶는다")
    void balanceSheetIsStability() {
        assertThat(SummaryLens.ofFinancial("BS", "ifrs-full_Assets", "자산총계")).isEqualTo(SummaryLens.STABILITY);
        assertThat(SummaryLens.ofFinancial("BS", "ifrs-full_Liabilities", "부채총계")).isEqualTo(SummaryLens.STABILITY);
        assertThat(SummaryLens.ofFinancial("BS", "ifrs-full_Equity", "자본총계")).isEqualTo(SummaryLens.STABILITY);
        assertThat(SummaryLens.ofFinancial("BS", "dart_CurrentLoansReceived", "단기 차입금"))
                .isEqualTo(SummaryLens.STABILITY);
        assertThat(SummaryLens.ofFinancial("BS", "ifrs-full_Inventories", "재고자산")).isEqualTo(SummaryLens.STABILITY);
    }

    @Test
    @DisplayName("현금흐름표 계정은 현금흐름, 배당·자기주식 계정은 재무제표와 관계없이 주주 환원으로 묶는다")
    void cashFlowAndShareholderAccounts() {
        assertThat(SummaryLens.ofFinancial("CF", null, "영업활동현금흐름")).isEqualTo(SummaryLens.CASH_FLOW);
        assertThat(SummaryLens.ofFinancial("CF", null, "배당금의 지급")).isEqualTo(SummaryLens.SHAREHOLDER);
        assertThat(SummaryLens.ofFinancial("BS", null, "자기주식")).isEqualTo(SummaryLens.SHAREHOLDER);
        assertThat(SummaryLens.ofFinancial("SCE", null, "연차배당")).isEqualTo(SummaryLens.SHAREHOLDER);
    }

    @Test
    @DisplayName("규칙에 없는 계정과 재무제표 구분을 모르는 계정은 기타로 둔다")
    void unknownAccountsAreOther() {
        assertThat(SummaryLens.ofFinancial("BS", null, "매출채권")).isEqualTo(SummaryLens.OTHER);
        assertThat(SummaryLens.ofFinancial(null, "ifrs-full_Revenue", "매출액")).isEqualTo(SummaryLens.OTHER);
        assertThat(SummaryLens.ofFinancial("IS", null, null)).isEqualTo(SummaryLens.OTHER);
        assertThat(SummaryLens.ofFinancial("XX", null, "자산총계")).isEqualTo(SummaryLens.OTHER);
    }

    @Test
    @DisplayName("문장 변화는 위험 관련 목차면 위험, 배당 목차면 주주 환원, 매출 및 수주상황이면 성장, 그 밖은 기타다")
    void textChangesFollowTheSectionPath() {
        assertThat(SummaryLens.ofText("II. 사업의 내용 > 5. 위험관리 및 파생거래", null)).isEqualTo(SummaryLens.RISK);
        assertThat(SummaryLens.ofText("XI. 그 밖에 투자자 보호를 위하여 필요한 사항 > 2. 우발부채 등에 관한 사항", null))
                .isEqualTo(SummaryLens.RISK);
        assertThat(SummaryLens.ofText("III. 재무에 관한 사항 > 6. 배당에 관한 사항", null))
                .isEqualTo(SummaryLens.SHAREHOLDER);
        assertThat(SummaryLens.ofText("II. 사업의 내용 > 4. 매출 및 수주상황", null)).isEqualTo(SummaryLens.GROWTH);
        assertThat(SummaryLens.ofText("II. 사업의 내용 > 1. 사업의 개요", null)).isEqualTo(SummaryLens.OTHER);
        assertThat(SummaryLens.ofText("XI. 그 밖에 투자자 보호를 위하여 필요한 사항 > 1. 공시내용 진행 및 변경사항", null))
                .isEqualTo(SummaryLens.OTHER);
        // 삼성전자 2026 반기보고서(20260814003699, 분석 10) 원문 목차
        assertThat(SummaryLens.ofText("I. 회사의 개요 > 4. 주식의 총수 등", null)).isEqualTo(SummaryLens.SHAREHOLDER);
        assertThat(SummaryLens.ofText("III. 재무에 관한 사항 > 7. 증권의 발행을 통한 자금조달에 관한 사항", null))
                .isEqualTo(SummaryLens.STABILITY);
        assertThat(SummaryLens.ofText("IV. 이사의 경영진단 및 분석의견 > 4. 유동성 및 자금조달과 지출", null))
                .isEqualTo(SummaryLens.STABILITY);
        assertThat(SummaryLens.ofText(null, null)).isEqualTo(SummaryLens.OTHER);
    }

    @Test
    @DisplayName("위치를 옮긴 변경은 이전 섹션 경로도 본다")
    void movedChangesAlsoUseThePreviousPath() {
        assertThat(SummaryLens.ofText("II. 사업의 내용 > 7. 기타 참고사항", "II. 사업의 내용 > 5. 위험관리 및 파생거래"))
                .isEqualTo(SummaryLens.RISK);
        assertThat(SummaryLens.ofText(null, "III. 재무에 관한 사항 > 6. 배당에 관한 사항"))
                .isEqualTo(SummaryLens.SHAREHOLDER);
    }

    @Test
    @DisplayName("관점 이름에 평가·추천 표현이 없다")
    void labelsHaveNoJudgment() {
        assertThat(Arrays.stream(SummaryLens.values()).map(SummaryLens::label))
                .containsExactly("수익성", "성장", "재무 안정성", "현금흐름", "주주 환원", "위험", "기타")
                .noneMatch(label -> label.matches(".*(좋|나쁘|우수|양호|저평가|고평가|매수|매도|추천|개선|악화).*"));
    }
}
