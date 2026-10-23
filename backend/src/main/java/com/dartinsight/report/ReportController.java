package com.dartinsight.report;

import com.dartinsight.common.web.ApiPaths;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 정기보고서 API(docs/api-spec.md). 화면 W-01 ②, W-03 머리글.
 */
@RestController
@RequestMapping(ApiPaths.BASE)
public class ReportController {

    private final ReportService reportService;

    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    @GetMapping(ApiPaths.COMPANY_REPORTS)
    public ReportListResponse list(@PathVariable String corpCode) {
        return ReportListResponse.from(corpCode, reportService.list(corpCode));
    }

    @GetMapping(ApiPaths.REPORT_BY_RCEPT_NO)
    public ReportDetailResponse get(@PathVariable String rceptNo) {
        return ReportDetailResponse.from(reportService.get(rceptNo));
    }
}
