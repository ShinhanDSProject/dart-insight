package com.dartinsight.summary.domain;

import com.dartinsight.analysis.domain.FinancialChange;
import com.dartinsight.analysis.domain.RiskSections;
import com.dartinsight.analysis.domain.TextChange;
import java.util.List;
import java.util.Set;

/**
 * 요약 한 줄을 묶는 투자자 관점(3.10, FS-64). 저장하지 않고 조회할 때 정한다(규칙이 바뀌어도 분석 버전을 올리지 않음).
 * 주제로 묶을 뿐이고 좋고 나쁨은 판단하지 않는다. 규칙은 docs/api-spec.md 요약 API의 '투자자 관점' 표와 같다.
 *
 * <ul>
 *   <li>재무 수치: 재무제표 구분(sj_div)과 계정 이름으로. 매출 계정 이름(매출액·매출·영업수익)은 2024 사업보고서
 *   삼성전자 20250311001085·LG디스플레이 20250312000906·카카오 20250324000901에서 확인한 것이다(AccountAliasesTest).
 *   모르는 계정은 OTHER.</li>
 *   <li>문장 변화: 섹션 경로로. 위험 관련 목차는 {@link RiskSections}(FS-61)를 그대로 쓰고, '배당'·'매출및수주'는 실제
 *   사업보고서 목차('III. 재무에 관한 사항 > 6. 배당에 관한 사항', 'II. 사업의 내용 > 4. 매출 및 수주상황',
 *   docs/verification/3.6-related-accuracy/precision.csv)에서 골랐다. 그 밖은 OTHER.</li>
 * </ul>
 */
public enum SummaryLens {

    PROFITABILITY("수익성"),
    GROWTH("성장"),
    STABILITY("재무 안정성"),
    CASH_FLOW("현금흐름"),
    SHAREHOLDER("주주 환원"),
    RISK("위험"),
    OTHER("기타");

    static final List<String> SHAREHOLDER_WORDS = List.of("배당", "자기주식");
    static final String REVENUE_ACCOUNT_ID = "ifrs-full_Revenue";
    static final Set<String> REVENUE_NAMES = Set.of("매출액", "매출", "영업수익");
    static final List<String> PROFIT_WORDS = List.of("이익", "손실", "손익", "비용", "원가", "수익", "관리비");
    static final List<String> BALANCE_WORDS = List.of("자산", "부채", "자본", "차입", "사채");
    static final List<String> SHAREHOLDER_SECTION_WORDS = List.of("배당");
    static final List<String> GROWTH_SECTION_WORDS = List.of("매출및수주");

    private final String label;

    SummaryLens(String label) {
        this.label = label;
    }

    /** 화면 이름(예: 재무 안정성) */
    public String label() {
        return label;
    }

    /** 저장된 재무 수치 결과의 관점. 표준계정 ID는 현재 보고서 쪽을 먼저 본다 */
    public static SummaryLens of(FinancialChange change) {
        String accountId = change.getCurrentAccountId() != null ? change.getCurrentAccountId()
                : change.getPreviousAccountId();
        return ofFinancial(change.getSjDiv(), accountId, change.getAccountName());
    }

    /** 저장된 문장 변경의 관점 */
    public static SummaryLens of(TextChange change) {
        return ofText(change.row().sectionPath(), change.row().previousSectionPath());
    }

    /**
     * 재무 수치 한 줄의 관점.
     *
     * @param sjDiv       재무제표 구분(BS, IS, CIS, CF, SCE). 모르면 null
     * @param accountId   표준계정 ID. 모르면 null
     * @param accountName 계정 이름. 모르면 null
     */
    public static SummaryLens ofFinancial(String sjDiv, String accountId, String accountName) {
        String name = compact(accountName);
        if (containsAny(name, SHAREHOLDER_WORDS)) {
            return SHAREHOLDER;
        }
        if (sjDiv == null) {
            return OTHER;
        }
        return switch (sjDiv) {
            case "CF" -> CASH_FLOW;
            case "IS", "CIS" -> incomeLens(accountId, name);
            case "BS", "SCE" -> containsAny(name, BALANCE_WORDS) ? STABILITY : OTHER;
            default -> OTHER;
        };
    }

    /** 문장 변화 한 줄의 관점. 섹션 경로(현재·이전) 중 하나라도 맞으면 그 관점이다. null 경로는 건너뛴다 */
    public static SummaryLens ofText(String sectionPath, String previousSectionPath) {
        if (RiskSections.isRiskRelated(sectionPath, previousSectionPath)) {
            return RISK;
        }
        String paths = compact(sectionPath) + "\n" + compact(previousSectionPath);
        if (containsAny(paths, SHAREHOLDER_SECTION_WORDS)) {
            return SHAREHOLDER;
        }
        return containsAny(paths, GROWTH_SECTION_WORDS) ? GROWTH : OTHER;
    }

    private static SummaryLens incomeLens(String accountId, String name) {
        if (REVENUE_ACCOUNT_ID.equals(accountId) || REVENUE_NAMES.contains(name)) {
            return GROWTH;
        }
        return containsAny(name, PROFIT_WORDS) ? PROFITABILITY : OTHER;
    }

    private static boolean containsAny(String text, List<String> words) {
        return words.stream().anyMatch(text::contains);
    }

    private static String compact(String text) {
        return text == null ? "" : text.replaceAll("\\s+", "");
    }
}
