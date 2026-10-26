package com.dartinsight.disclosure.dto;

import com.dartinsight.disclosure.domain.Disclosure;
import com.dartinsight.disclosure.domain.DisclosureGroup;
import com.dartinsight.report.domain.DartLinks;
import java.time.LocalDate;

/**
 * 최근 공시 한 건.
 *
 * @param periodic 이 서비스의 정기보고서 목록에 들어가는 보고서인지('이 보고서로 비교하기')
 * @param remarks  비고(rm) 원문. 없으면 null
 */
public record CompanyDisclosureItemResponse(
        String rceptNo,
        String reportName,
        String filerName,
        LocalDate receivedDate,
        DisclosureGroup group,
        String groupLabel,
        boolean periodic,
        String dartUrl,
        String remarks) {

    public static CompanyDisclosureItemResponse from(Disclosure disclosure) {
        DisclosureGroup group = disclosure.group();
        return new CompanyDisclosureItemResponse(
                disclosure.rceptNo(),
                disclosure.displayName(),
                disclosure.filerName(),
                disclosure.rceptDt(),
                group,
                group.label(),
                disclosure.periodic(),
                DartLinks.viewer(disclosure.rceptNo()),
                disclosure.remark());
    }
}
