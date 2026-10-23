package com.dartinsight.summary;

import static org.assertj.core.api.Assertions.assertThat;

import com.dartinsight.financial.FinancialAccount;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 사전과 정리 규칙은 2024 사업보고서(연결) 5건의 재무제표 API 응답과 원문 경영진단·사업의 내용 문단으로 확인했다(2026-10-23).
 * 계정명을 그대로 찾던 방식에서 후보 문단 수(경영진단·사업의 내용):
 * <ul>
 *   <li>SK하이닉스 20250319000665: 영업이익(손실) 0 (본문 '영업이익' 5), 당기순이익(손실) 0 (본문 '순이익' 5)</li>
 *   <li>카카오 20250324000901: 영업이익(손실) 0 (본문 '영업이익' 1), 당기순이익(손실) 0 (본문 '당기순손실' 1),
 *   자산총계 1 (본문 '자산총액' 1), 매출 계정명 '영업수익' 4</li>
 *   <li>LG디스플레이 20250312000906: 영업손실 2 (본문 '영업적자' 1), 매출 계정명 '매출'</li>
 *   <li>삼성전자 20250311001085: 영업이익 7, 매출액 4</li>
 *   <li>신한지주 20250318000993: 영업이익(ifrs-full_ProfitLossFromOperatingActivities) 6, 본문 '총자산' 7</li>
 * </ul>
 * '영업손익'(EBITDA 정의에만 나옴)·'당기순손익'(환율 민감도 문장에만 나옴)은 설명 문장이 아니라 넣지 않았다.
 */
class AccountAliasesTest {

    @Test
    @DisplayName("괄호가 붙은 계정명은 괄호 밖 글을 검색어로 쓰고 2글자 이하인 괄호 안 글은 버린다")
    void splitsParenthesesAndDropsShortTerms() {
        assertThat(AccountAliases.fromName("영업이익 (손실)")).containsExactly("영업이익", "손실");
        assertThat(AccountAliases.of(FinancialAccount.NON_STANDARD_ACCOUNT_ID, "영업이익(손실)"))
                .containsExactly("영업이익");
    }

    @Test
    @DisplayName("손실인 해에 계정명이 '영업손실'로 바뀌어도 표준계정 ID로 영업이익 검색어를 쓴다")
    void usesAccountIdWhenTheNameChangesInALossYear() {
        assertThat(AccountAliases.of("dart_OperatingIncomeLoss", "영업손실"))
                .containsExactly("영업손실", "영업이익", "영업적자");
        assertThat(AccountAliases.of("dart_OperatingIncomeLoss", "영업이익(손실)"))
                .containsExactly("영업이익", "영업손실", "영업적자");
    }

    @Test
    @DisplayName("금융회사의 영업이익 표준계정 ID도 같은 검색어를 쓴다")
    void financialCompanyOperatingIncomeUsesTheSameTerms() {
        assertThat(AccountAliases.of("ifrs-full_ProfitLossFromOperatingActivities", "영업이익"))
                .containsExactly("영업이익", "영업손실", "영업적자");
    }

    @Test
    @DisplayName("2글자 계정명 '매출'은 버리고 사전의 '매출액'으로 찾는다")
    void dropsTwoLetterNameButKeepsDictionaryTerms() {
        assertThat(AccountAliases.of("ifrs-full_Revenue", "매출")).containsExactly("매출액", "영업수익");
    }

    @Test
    @DisplayName("재무상태표 합계는 본문의 자산총액·총자산 표현도 검색어로 쓴다")
    void balanceSheetTotalsIncludeBodyExpressions() {
        assertThat(AccountAliases.of("ifrs-full_Assets", "자산총계")).containsExactly("자산총계", "자산총액", "총자산");
        assertThat(AccountAliases.of("ifrs-full_Liabilities", "부채총계")).containsExactly("부채총계", "부채총액");
    }

    @Test
    @DisplayName("표준계정이 아니거나 사전에 없는 계정은 정리 규칙만 쓴다")
    void nonStandardOrUnknownAccountsUseOnlyTheName() {
        assertThat(AccountAliases.of(FinancialAccount.NON_STANDARD_ACCOUNT_ID, "기타금융수익"))
                .containsExactly("기타금융수익");
        assertThat(AccountAliases.of("ifrs-full_CostOfSales", "매출원가")).containsExactly("매출원가");
        assertThat(AccountAliases.of(null, " ")).isEmpty();
    }
}
