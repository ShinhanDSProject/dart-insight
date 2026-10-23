package com.dartinsight.report.dto;

import com.dartinsight.report.domain.Correction;
import com.dartinsight.report.domain.DartLinks;
import com.dartinsight.report.domain.FinancialDataStatus;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.domain.ReportType;
import java.time.LocalDate;

/** 보고서 목록 한 줄. 비교 보고서 쌍·비교 가능성·분석 응답에서도 같은 모양으로 쓴다. */
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

    public static ReportItemResponse from(Report report, FinancialDataStatus financialDataStatus) {
        return new ReportItemResponse(report.getRceptNo(), report.getReportName(), report.getReportType(),
                report.getReportType().disclosureType(), report.getFiscalYear(), report.getPeriodEnd(),
                report.getRceptDt(), report.getCorrection(), financialDataStatus,
                DartLinks.viewer(report.getRceptNo()));
    }
}
