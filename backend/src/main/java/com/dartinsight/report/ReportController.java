package com.dartinsight.report;

import com.dartinsight.common.error.ErrorCode;
import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/**
 * 정기보고서 API(docs/api-spec.md). 화면 W-01 ②.
 */
@RestController
public class ReportController {

    private final ReportService reportService;

    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    @GetMapping("/api/companies/{corpCode}/reports")
    public ReportListResponse list(@PathVariable String corpCode) {
        ReportService.ReportList list = reportService.list(corpCode);
        LocalDateTime fetchedAt = list.company().getReportsFetchedAt();
        return new ReportListResponse(
                corpCode,
                fetchedAt,
                list.refreshError(),
                list.reports().stream()
                        .map(r -> ReportItemResponse.from(r, FinancialDataStatus.beforeFetch(r)))
                        .toList());
    }

    /**
     * @param refreshError OpenDART에서 다시 받지 못해 저장된 목록을 돌려줄 때 그 이유
     */
    public record ReportListResponse(
            String corpCode,
            @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss") LocalDateTime fetchedAt,
            ErrorCode refreshError,
            List<ReportItemResponse> items) {
    }

    public record ReportItemResponse(
            String rceptNo,
            String reportName,
            ReportType reportType,
            String disclosureType,
            int fiscalYear,
            LocalDate periodEnd,
            LocalDate receivedAt,
            Correction correction,
            FinancialDataStatus financialDataStatus,
            String dartUrl) {

        static ReportItemResponse from(Report report, FinancialDataStatus financialDataStatus) {
            return new ReportItemResponse(report.getRceptNo(), report.getReportName(), report.getReportType(),
                    report.getReportType().disclosureType(), report.getFiscalYear(), report.getPeriodEnd(),
                    report.getRceptDt(), report.getCorrection(), financialDataStatus,
                    DartLinks.viewer(report.getRceptNo()));
        }
    }
}
