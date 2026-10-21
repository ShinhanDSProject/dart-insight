package com.dartinsight.comparison;

import com.dartinsight.report.FinancialDataStatus;
import com.dartinsight.report.Report;
import com.dartinsight.report.ReportController.ReportItemResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 비교 보고서 쌍 API(docs/api-spec.md). 화면 W-01 ②.
 */
@RestController
public class ReportPairController {

    private final ReportPairService pairService;

    public ReportPairController(ReportPairService pairService) {
        this.pairService = pairService;
    }

    @GetMapping("/api/companies/{corpCode}/report-pairs")
    public ReportPairResponse find(@PathVariable String corpCode, @RequestParam ComparisonBasis basis,
            @RequestParam(required = false) String currentRceptNo) {
        ReportPairService.ReportPair pair = pairService.findPair(corpCode, basis, currentRceptNo);
        return new ReportPairResponse(pair.basis(), item(pair.current()), item(pair.previous()),
                pair.reason() == null ? null : new Reason(pair.reason().name(), pair.reason().message()));
    }

    private static ReportItemResponse item(Report report) {
        return report == null ? null : ReportItemResponse.from(report, FinancialDataStatus.beforeFetch(report));
    }

    public record ReportPairResponse(ComparisonBasis basis, ReportItemResponse current, ReportItemResponse previous,
            Reason reason) {
    }

    public record Reason(String code, String message) {
    }
}
