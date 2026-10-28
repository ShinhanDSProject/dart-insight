package com.dartinsight.followup.domain;

import com.dartinsight.report.domain.Report;
import com.dartinsight.report.domain.ReportType;
import java.util.List;
import java.util.Optional;

/**
 * 대조할 두 사업보고서(ADR-0041). 올해는 대상 기간이 가장 최근인 사업보고서, 작년은 그보다 사업연도가 정확히 한 해 앞선
 * 사업보고서다. 반기·분기보고서는 쓰지 않는다.
 *
 * @param current  없으면 null
 * @param previous 없으면 null
 */
public record AnnualReportPair(Report current, Report previous) {

    /** @param reports 정기보고서 목록(대상 기간이 최근인 순서) */
    public static AnnualReportPair of(List<Report> reports) {
        List<Report> annual = reports.stream().filter(r -> r.getReportType() == ReportType.ANNUAL).toList();
        if (annual.isEmpty()) {
            return new AnnualReportPair(null, null);
        }
        Report current = annual.getFirst();
        Report previous = annual.stream().filter(r -> r.getFiscalYear() == current.getFiscalYear() - 1).findFirst()
                .orElse(null);
        return new AnnualReportPair(current, previous);
    }

    /** 두 보고서가 다 있지 않으면 그 사유 */
    public Optional<PlanFollowupReason> missing() {
        if (current == null) {
            return Optional.of(PlanFollowupReason.NO_REPORT);
        }
        return previous == null ? Optional.of(PlanFollowupReason.NO_PREVIOUS_REPORT) : Optional.empty();
    }
}
