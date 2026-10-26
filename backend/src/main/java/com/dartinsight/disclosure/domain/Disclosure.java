package com.dartinsight.disclosure.domain;

import com.dartinsight.report.domain.ReportNameParser;
import java.time.LocalDate;
import java.util.regex.Pattern;

/**
 * 받아 둔 공시 한 건(company_disclosure 한 행). OpenDART 공시검색 응답 한 줄이다.
 *
 * @param reportName 보고서명 원문(앞뒤 공백만 뺌)
 * @param filerName  제출인. 없으면 null
 * @param remark     비고(rm) 원문. 없으면 null
 */
public record Disclosure(String rceptNo, String reportName, String filerName, LocalDate rceptDt, String remark) {

    private static final Pattern SPACES = Pattern.compile("\\s+");

    /** 화면에 보여 줄 보고서명. 이어진 공백(OpenDART가 덧붙인 설명 앞의 여러 칸)을 한 칸으로 줄인다. */
    public String displayName() {
        return SPACES.matcher(reportName.strip()).replaceAll(" ");
    }

    public DisclosureGroup group() {
        return DisclosureGroupRules.classify(reportName);
    }

    /** 이 서비스의 정기보고서 목록에 들어가는 보고서(12월 결산 회사의 사업·반기·분기보고서)인지 */
    public boolean periodic() {
        return ReportNameParser.parse(reportName, remark).isPresent();
    }
}
