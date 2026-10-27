package com.dartinsight.disclosure.domain;

import java.util.List;
import java.util.regex.Pattern;

/**
 * 공시 제목 낱말로 묶음을 정하는 규칙표(FS-48, #332). LLM을 쓰지 않는다.
 *
 * <p>제목은 OpenDART 보고서명(report_nm)에서 앞머리 꼬리표([기재정정]·[첨부정정] 등)와 뒤에 덧붙인 설명(공백 여러 칸 뒤의
 * 괄호, 예: "기타경영사항(자율공시)              (소규모합병 ...)")을 떼고, 공백을 모두 뺀 값이다.
 * 위에서부터 차례로 보고 처음 맞는 규칙의 묶음을 쓴다. 맞는 규칙이 없으면 {@link DisclosureGroup#OTHER}다.
 * 순서가 뜻을 가진다: 예를 들어 '임원ㆍ주요주주특정증권등소유상황보고서'는 '임원'(지배구조)보다 지분 변동이 먼저이고,
 * '증권발행실적보고서'는 '실적'(실적·영업)보다 자금 조달이 먼저다.
 *
 * <p>낱말은 실제 OpenDART 공시검색 응답(삼성전자 최근 1년, 전체 시장 2026-10-19~23)에 나온 보고서명과
 * DART 표준 보고서명에서만 골랐다. 낱말을 더하면 DisclosureGroupRulesTest에 그 보고서명을 함께 넣는다.
 */
public final class DisclosureGroupRules {

    private static final Pattern LEADING_TAGS = Pattern.compile("^(?:\\s*\\[[^\\]]*\\])+");
    private static final Pattern EXTRA_INFO = Pattern.compile("\\s{2,}.*$", Pattern.DOTALL);
    private static final Pattern SPACES = Pattern.compile("\\s+");

    /** @param prefix true면 제목이 낱말로 시작해야 맞고, false면 제목 어디에 있어도 맞는다 */
    public record Rule(DisclosureGroup group, String keyword, boolean prefix) {

        boolean matches(String title) {
            return prefix ? title.startsWith(keyword) : title.contains(keyword);
        }
    }

    /** 규칙표. 위에서부터 처음 맞는 규칙을 쓴다. */
    public static final List<Rule> RULES = List.of(
            // 정기보고서: 제목이 보고서 종류로 시작할 때만('감사보고서제출'처럼 중간에 '보고서'가 있는 공시와 구분)
            starts(DisclosureGroup.PERIODIC, "사업보고서"),
            starts(DisclosureGroup.PERIODIC, "반기보고서"),
            starts(DisclosureGroup.PERIODIC, "분기보고서"),
            // 지분 변동
            has(DisclosureGroup.OWNERSHIP, "주식등의대량보유상황보고서"),
            has(DisclosureGroup.OWNERSHIP, "주요주주특정증권등"),
            has(DisclosureGroup.OWNERSHIP, "최대주주"),
            has(DisclosureGroup.OWNERSHIP, "공개매수"),
            has(DisclosureGroup.OWNERSHIP, "자기주식"),
            has(DisclosureGroup.OWNERSHIP, "신탁계약에의한취득상황보고서"),
            has(DisclosureGroup.OWNERSHIP, "신탁계약해지결과보고서"),
            has(DisclosureGroup.OWNERSHIP, "주식소각"),
            has(DisclosureGroup.OWNERSHIP, "주식매수선택권"),
            // 자금 조달
            has(DisclosureGroup.FUNDING, "유상증자"),
            has(DisclosureGroup.FUNDING, "전환사채"),
            has(DisclosureGroup.FUNDING, "신주인수권부사채"),
            has(DisclosureGroup.FUNDING, "교환사채"),
            has(DisclosureGroup.FUNDING, "사채권"),
            has(DisclosureGroup.FUNDING, "조건부자본증권"),
            has(DisclosureGroup.FUNDING, "채무증권"),
            has(DisclosureGroup.FUNDING, "증권신고서"),
            has(DisclosureGroup.FUNDING, "투자설명서"),
            has(DisclosureGroup.FUNDING, "일괄신고"),
            has(DisclosureGroup.FUNDING, "증권발행실적보고서"),
            has(DisclosureGroup.FUNDING, "증권발행결과"),
            has(DisclosureGroup.FUNDING, "소액공모"),
            has(DisclosureGroup.FUNDING, "단기차입금"),
            has(DisclosureGroup.FUNDING, "신주인수권행사"),
            has(DisclosureGroup.FUNDING, "전환청구권"),
            has(DisclosureGroup.FUNDING, "전환가액"),
            // 지배구조
            has(DisclosureGroup.GOVERNANCE, "대표이사"),
            has(DisclosureGroup.GOVERNANCE, "이사의선임"),
            has(DisclosureGroup.GOVERNANCE, "임원"),
            has(DisclosureGroup.GOVERNANCE, "주주총회"),
            has(DisclosureGroup.GOVERNANCE, "의결권대리행사권유"),
            has(DisclosureGroup.GOVERNANCE, "합병"),
            has(DisclosureGroup.GOVERNANCE, "회사분할"),
            has(DisclosureGroup.GOVERNANCE, "영업양수"),
            has(DisclosureGroup.GOVERNANCE, "영업양도"),
            has(DisclosureGroup.GOVERNANCE, "주식교환"),
            has(DisclosureGroup.GOVERNANCE, "경영권"),
            has(DisclosureGroup.GOVERNANCE, "기업지배구조보고서"),
            has(DisclosureGroup.GOVERNANCE, "지주회사"),
            // 실적·영업
            has(DisclosureGroup.BUSINESS, "실적"),
            has(DisclosureGroup.BUSINESS, "매출액또는손익구조"),
            has(DisclosureGroup.BUSINESS, "공급계약"),
            has(DisclosureGroup.BUSINESS, "신규시설투자"),
            has(DisclosureGroup.BUSINESS, "유형자산"),
            has(DisclosureGroup.BUSINESS, "타법인주식및출자증권"),
            has(DisclosureGroup.BUSINESS, "기업설명회"),
            has(DisclosureGroup.BUSINESS, "투자판단관련주요경영사항"),
            has(DisclosureGroup.BUSINESS, "장래사업"),
            has(DisclosureGroup.BUSINESS, "영업"));

    private DisclosureGroupRules() {
    }

    public static DisclosureGroup classify(String reportName) {
        String title = title(reportName);
        for (Rule rule : RULES) {
            if (rule.matches(title)) {
                return rule.group();
            }
        }
        return DisclosureGroup.OTHER;
    }

    /** 규칙에 대는 제목: 앞머리 꼬리표와 뒤에 덧붙인 설명을 떼고 공백을 모두 뺀 값. 관련 수시공시(3.6) 규칙도 쓴다 */
    public static String title(String reportName) {
        if (reportName == null) {
            return "";
        }
        String withoutTags = LEADING_TAGS.matcher(reportName.strip()).replaceFirst("").strip();
        String withoutExtra = EXTRA_INFO.matcher(withoutTags).replaceFirst("");
        return SPACES.matcher(withoutExtra).replaceAll("");
    }

    private static Rule starts(DisclosureGroup group, String keyword) {
        return new Rule(group, keyword, true);
    }

    private static Rule has(DisclosureGroup group, String keyword) {
        return new Rule(group, keyword, false);
    }
}
