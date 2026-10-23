package com.dartinsight.comparison;

import com.dartinsight.report.FinancialDataStatus;
import com.dartinsight.report.Report;
import com.dartinsight.report.ReportItemResponse;
import java.util.Map;

public record ReportPairResponse(ComparisonBasis basis, ReportItemResponse current, ReportItemResponse previous,
        Reason reason) {

    static ReportPairResponse of(ReportPairService.ReportPair pair, Map<String, FinancialDataStatus> statuses) {
        return new ReportPairResponse(pair.basis(), item(pair.current(), statuses), item(pair.previous(), statuses),
                pair.reason() == null ? null : new Reason(pair.reason().name(), pair.reason().message()));
    }

    private static ReportItemResponse item(Report report, Map<String, FinancialDataStatus> statuses) {
        return report == null ? null : ReportItemResponse.from(report, statuses.get(report.getRceptNo()));
    }

    public record Reason(String code, String message) {
    }
}
