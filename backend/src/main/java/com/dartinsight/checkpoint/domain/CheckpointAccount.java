package com.dartinsight.checkpoint.domain;

import com.dartinsight.financial.domain.FinancialAccount;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.function.Predicate;

/**
 * 재무 체크 포인트(FS-62)에 쓰는 재무제표 계정과 찾는 규칙(docs/api-spec.md GET /api/companies/{corpCode}/checkpoints).
 * 정해 둔 재무제표(sj_div) 순서대로, 그 안에서 표준계정 ID가 목록에 있는 계정을 먼저, 없으면 공백을 뺀 계정명이 목록에 있는
 * 계정을 쓴다. 같은 조건이 여럿이면 원문 순서(ord)가 앞선 것이다.
 *
 * <p>ID·이름은 저장된 OpenDART 단일회사 전체 재무제표 실제 응답에서 확인한 것만 넣었다(2026-10-29, 삼성전자 20160330003536·
 * 20250311001085·20260310002820·20260814003699, SK하이닉스 20260814003509, 에코프로비엠 20260515001109·20260814002535,
 * KB금융 20260814004200). {@code ifrs_} 앞머리는 2015 사업연도 응답의 옛 ID다. 추측한 ID·이름은 넣지 않는다.
 */
public enum CheckpointAccount {

    REVENUE("매출", List.of("IS", "CIS"), Set.of("ifrs-full_Revenue", "ifrs_Revenue"),
            Set.of("매출액", "매출", "영업수익", "수익(매출액)")),
    OPERATING_INCOME("영업이익", List.of("IS", "CIS"),
            Set.of("dart_OperatingIncomeLoss", "ifrs-full_ProfitLossFromOperatingActivities"),
            Set.of("영업이익", "영업이익(손실)")),
    OPERATING_CASH_FLOW("영업활동현금흐름", List.of("CF"),
            Set.of("ifrs-full_CashFlowsFromUsedInOperatingActivities", "ifrs_CashFlowsFromUsedInOperatingActivities"),
            Set.of("영업활동현금흐름", "영업활동순현금흐름")),
    /** 매출채권만. '매출채권및기타채권'처럼 다른 채권이 함께 든 계정은 넣지 않는다 */
    TRADE_RECEIVABLES("매출채권", List.of("BS"), Set.of("ifrs-full_CurrentTradeReceivables"), Set.of("매출채권")),
    INVENTORIES("재고자산", List.of("BS"), Set.of("ifrs-full_Inventories", "ifrs_Inventories"), Set.of("재고자산")),
    SHORT_TERM_BORROWINGS("단기차입금", List.of("BS"),
            Set.of("ifrs-full_ShorttermBorrowings", "dart_ShortTermBorrowings", "dart_CurrentLoansReceived"),
            Set.of("단기차입금")),
    CURRENT_PORTION_OF_LONG_TERM_BORROWINGS("유동성장기부채", List.of("BS"),
            Set.of("ifrs-full_CurrentPortionOfLongtermBorrowings", "ifrs_CurrentPortionOfLongtermBorrowings"),
            Set.of("유동성장기부채", "유동성장기차입금")),
    TOTAL_LIABILITIES("부채총계", List.of("BS"), Set.of("ifrs-full_Liabilities", "ifrs_Liabilities"), Set.of("부채총계")),
    /** 재무상태표에서만 찾는다(자본변동표의 ifrs_Equity '기말자본'과 섞이지 않게) */
    TOTAL_EQUITY("자본총계", List.of("BS"), Set.of("ifrs-full_Equity", "ifrs_Equity"), Set.of("자본총계"));

    private final String label;
    private final List<String> sjDivs;
    private final Set<String> accountIds;
    private final Set<String> names;

    CheckpointAccount(String label, List<String> sjDivs, Set<String> accountIds, Set<String> names) {
        this.label = label;
        this.sjDivs = sjDivs;
        this.accountIds = accountIds;
        this.names = names;
    }

    public String label() {
        return label;
    }

    /** 재무제표 계정 가운데 이 계정. 찾지 못하면 빈 값 */
    public Optional<FinancialAccount> find(List<FinancialAccount> accounts) {
        for (String sjDiv : sjDivs) {
            List<FinancialAccount> statement = accounts.stream().filter(a -> sjDiv.equals(a.getSjDiv())).toList();
            Optional<FinancialAccount> found = first(statement, a -> accountIds.contains(a.getAccountId()))
                    .or(() -> first(statement, a -> names.contains(compact(a.getAccountName()))));
            if (found.isPresent()) {
                return found;
            }
        }
        return Optional.empty();
    }

    private static Optional<FinancialAccount> first(List<FinancialAccount> accounts, Predicate<FinancialAccount> match) {
        return accounts.stream()
                .filter(match)
                .min(Comparator.comparing((FinancialAccount a) -> a.getOrd() == null ? Integer.MAX_VALUE : a.getOrd()));
    }

    static String compact(String name) {
        return name == null ? "" : name.replaceAll("\\s+", "");
    }
}
