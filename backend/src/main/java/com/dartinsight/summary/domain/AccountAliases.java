package com.dartinsight.summary.domain;

import com.dartinsight.financial.domain.FinancialAccount;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 설명 후보를 찾을 검색어(ADR-0015). 계정명 정리 규칙과 표준계정 ID(account_id) 사전으로 만든다.
 * <ul>
 *   <li>정리 규칙: 공백을 빼고, {@code X(Y)} 꼴은 X와 Y를 각각 검색어로 쓴다. 여기서 나온 2글자 이하 검색어는
 *   버린다('손실'·'매출'이 다른 계정 문단에 걸리지 않게).</li>
 *   <li>사전: 같은 표준계정이라도 회사·연도마다 계정명이 달라(영업이익 / 영업이익(손실) / 영업손실, 영업활동현금흐름 /
 *   영업활동순현금흐름) ID로 찾는다. 실제 공시의 설명 문장에서 확인한 표현만 넣는다(2024 사업보고서 5건, 접수번호는
 *   AccountAliasesTest).</li>
 * </ul>
 * 결과가 달라지게 바꾸면 backend Analysis.CURRENT_VERSION을 함께 올린다.
 */
public final class AccountAliases {

    static final int MIN_RULE_TERM_LENGTH = 3;
    private static final Pattern PARENTHESES = Pattern.compile("\\(([^()]*)\\)");

    private static final List<String> OPERATING_INCOME = List.of("영업이익", "영업손실", "영업적자");
    static final Map<String, List<String>> BY_ACCOUNT_ID = Map.of(
            "ifrs-full_Revenue", List.of("매출액", "영업수익"),
            "dart_OperatingIncomeLoss", OPERATING_INCOME,
            // 금융회사는 영업이익을 이 ID로 낸다(신한지주 20250318000993)
            "ifrs-full_ProfitLossFromOperatingActivities", OPERATING_INCOME,
            "ifrs-full_ProfitLoss", List.of("당기순이익", "당기순손실", "순이익", "순손실"),
            "ifrs-full_Assets", List.of("자산총계", "자산총액", "총자산"),
            "ifrs-full_Liabilities", List.of("부채총계", "부채총액"),
            "ifrs-full_CashFlowsFromUsedInOperatingActivities", List.of("영업활동현금흐름", "영업현금흐름"));

    private AccountAliases() {
    }

    /** 계정의 검색어. 계정명에서 나온 것이 먼저, 사전에서 나온 것이 뒤. 겹치면 한 번만 */
    public static List<String> of(String accountId, String accountName) {
        Set<String> terms = new LinkedHashSet<>();
        for (String term : fromName(accountName)) {
            if (term.length() >= MIN_RULE_TERM_LENGTH) {
                terms.add(term);
            }
        }
        if (accountId != null && !FinancialAccount.NON_STANDARD_ACCOUNT_ID.equals(accountId)) {
            terms.addAll(BY_ACCOUNT_ID.getOrDefault(accountId, List.of()));
        }
        return List.copyOf(terms);
    }

    /** 공백을 뺀 계정명에서 괄호 밖 글과 괄호 안 글을 나눈다. 예: 영업이익(손실) → [영업이익, 손실] */
    static List<String> fromName(String accountName) {
        String name = compact(accountName);
        if (name.isEmpty()) {
            return List.of();
        }
        Set<String> parts = new LinkedHashSet<>();
        parts.add(PARENTHESES.matcher(name).replaceAll(""));
        Matcher inside = PARENTHESES.matcher(name);
        while (inside.find()) {
            parts.add(inside.group(1));
        }
        parts.remove("");
        return List.copyOf(parts);
    }

    private static String compact(String text) {
        return text == null ? "" : text.replaceAll("\\s+", "");
    }
}
