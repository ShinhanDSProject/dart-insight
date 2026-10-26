package com.dartinsight.financial.domain;

import java.util.Arrays;
import java.util.Optional;

/**
 * 주요 재무 흐름(1.2, FS-46)에 보여 주는 OpenDART 주요계정. 화면과 API는 이 키로 계정을 가리킨다.
 * OpenDART 계정명(account_nm)에서 공백과 끝의 '(손실)'을 뺀 이름이 {@link #matchName}과 같으면 그 계정이다
 * (예: '영업이익(손실)' → OPERATING_INCOME, '법인세차감전 순이익' → PROFIT_BEFORE_TAX).
 * 순서는 화면에 보이는 순서다(재무상태표 다음 손익).
 */
public enum KeyAccount {

    CURRENT_ASSETS("유동자산", "BS"),
    NON_CURRENT_ASSETS("비유동자산", "BS"),
    TOTAL_ASSETS("자산총계", "BS"),
    CURRENT_LIABILITIES("유동부채", "BS"),
    NON_CURRENT_LIABILITIES("비유동부채", "BS"),
    TOTAL_LIABILITIES("부채총계", "BS"),
    CAPITAL_STOCK("자본금", "BS"),
    RETAINED_EARNINGS("이익잉여금", "BS"),
    TOTAL_EQUITY("자본총계", "BS"),
    REVENUE("매출액", "IS"),
    OPERATING_INCOME("영업이익", "IS"),
    PROFIT_BEFORE_TAX("법인세차감전 순이익", "IS"),
    NET_INCOME("당기순이익", "IS"),
    COMPREHENSIVE_INCOME("총포괄손익", "IS");

    private static final String LOSS_SUFFIX = "(손실)";

    private final String label;
    private final String sjDiv;
    private final String matchName;

    KeyAccount(String label, String sjDiv) {
        this.label = label;
        this.sjDiv = sjDiv;
        this.matchName = normalize(label);
    }

    public String label() {
        return label;
    }

    /** BS 재무상태표, IS 손익 */
    public String sjDiv() {
        return sjDiv;
    }

    public boolean isBalanceSheet() {
        return "BS".equals(sjDiv);
    }

    /** OpenDART 계정명으로 찾는다. 정해 둔 계정이 아니면 비어 있다. */
    public static Optional<KeyAccount> fromAccountName(String accountName) {
        if (accountName == null) {
            return Optional.empty();
        }
        String name = normalize(accountName);
        return Arrays.stream(values()).filter(k -> k.matchName.equals(name)).findFirst();
    }

    private static String normalize(String name) {
        String compact = name.replaceAll("\\s+", "");
        return compact.endsWith(LOSS_SUFFIX) ? compact.substring(0, compact.length() - LOSS_SUFFIX.length())
                : compact;
    }
}
