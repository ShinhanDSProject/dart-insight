package com.dartinsight.comparison.dto;

import com.dartinsight.comparison.domain.AmountBasis;
import com.dartinsight.comparison.service.ComparabilityService.ComparabilityResult;
import com.dartinsight.comparison.service.ComparabilityService;
import com.dartinsight.comparison.domain.StatementRules.StatementRule;
import com.dartinsight.financial.domain.FsDiv;
import com.dartinsight.report.domain.FinancialDataStatus;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.dto.ReportItemResponse;
import java.util.List;
import java.util.Map;

public record ComparabilityResponse(
        boolean comparable,
        ComparabilityService.Level level,
        FsDiv fsDiv,
        ReportItemResponse current,
        ReportItemResponse previous,
        List<StatementResponse> statements,
        List<CheckResponse> checks,
        List<ComparabilityService.Reason> reasons) {

    public static ComparabilityResponse from(ComparabilityResult r, Map<String, FinancialDataStatus> statuses) {
        return new ComparabilityResponse(r.comparable(), r.level(), r.fsDiv(), item(r.current(), statuses),
                item(r.previous(), statuses),
                r.statements().stream().map(StatementResponse::from).toList(),
                r.checks().stream().map(CheckResponse::from).toList(),
                r.reasons());
    }

    private static ReportItemResponse item(Report report, Map<String, FinancialDataStatus> statuses) {
        return ReportItemResponse.from(report, statuses.get(report.getRceptNo()));
    }

    public record StatementResponse(String sjDiv, String label, boolean comparable, AmountBasis amountBasis,
            String note) {

        static StatementResponse from(StatementRule rule) {
            return new StatementResponse(rule.type().name(), rule.type().label(), rule.comparable(),
                    rule.amountBasis(), rule.note());
        }
    }

    public record CheckResponse(String item, String label, String status, String detail) {

        static CheckResponse from(ComparabilityService.Check check) {
            return new CheckResponse(check.item().name(), check.item().label(), check.status().name(),
                    check.detail());
        }
    }
}
