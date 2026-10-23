package com.dartinsight.comparison;

import com.dartinsight.common.web.ApiPaths;
import com.dartinsight.report.FinancialDataStatus;
import com.dartinsight.report.Report;
import com.dartinsight.report.ReportService;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Stream;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 비교 보고서 쌍 API(docs/api-spec.md). 화면 W-01 ②.
 */
@RestController
@RequestMapping(ApiPaths.COMPANY_REPORT_PAIRS)
public class ReportPairController {

    private final ReportPairService pairService;
    private final ReportService reportService;

    public ReportPairController(ReportPairService pairService, ReportService reportService) {
        this.pairService = pairService;
        this.reportService = reportService;
    }

    @GetMapping
    public ReportPairResponse find(@PathVariable String corpCode, @RequestParam ComparisonBasis basis,
            @RequestParam(required = false) String currentRceptNo) {
        ReportPairService.ReportPair pair = pairService.findPair(corpCode, basis, currentRceptNo);
        List<Report> reports = Stream.of(pair.current(), pair.previous()).filter(Objects::nonNull).toList();
        Map<String, FinancialDataStatus> statuses = reportService.financialDataStatuses(corpCode, reports);
        return ReportPairResponse.of(pair, statuses);
    }
}
