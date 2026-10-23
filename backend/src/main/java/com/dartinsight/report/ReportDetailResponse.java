package com.dartinsight.report;

import java.time.LocalDate;

/**
 * @param remark  OpenDART 비고(rm) 원문. 없으면 null
 * @param latest  OpenDART 최신 목록에 있는 보고서인지. 정정 공시로 대체됐으면 false
 */
public record ReportDetailResponse(
        String rceptNo,
        String corpCode,
        String corpName,
        String reportName,
        ReportType reportType,
        String disclosureType,
        int fiscalYear,
        LocalDate periodEnd,
        LocalDate receivedAt,
        Correction correction,
        String remark,
        String filerName,
        boolean latest,
        FinancialDataStatus financialDataStatus,
        String dartUrl) {

    static ReportDetailResponse from(ReportService.ReportDetail detail) {
        Report r = detail.report();
        return new ReportDetailResponse(r.getRceptNo(), r.getCorpCode(), detail.company().getCorpName(),
                r.getReportName(), r.getReportType(), r.getReportType().disclosureType(), r.getFiscalYear(),
                r.getPeriodEnd(), r.getRceptDt(), r.getCorrection(), r.getRemark(), r.getFilerName(),
                detail.latest(), detail.financialDataStatus(), DartLinks.viewer(r.getRceptNo()));
    }
}
