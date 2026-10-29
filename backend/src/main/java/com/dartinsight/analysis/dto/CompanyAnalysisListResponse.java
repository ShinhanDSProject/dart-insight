package com.dartinsight.analysis.dto;

import com.dartinsight.analysis.domain.CompletedAnalysis;
import com.dartinsight.comparison.domain.ComparisonBasis;
import com.dartinsight.report.domain.Report;
import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** 기업의 이미 분석한 비교 목록(docs/api-spec.md GET /api/companies/{corpCode}/analyses) */
public record CompanyAnalysisListResponse(List<Item> items) {

    public static CompanyAnalysisListResponse from(List<CompletedAnalysis> analyses) {
        return new CompanyAnalysisListResponse(analyses.stream().map(Item::from).toList());
    }

    public record Item(
            Long analysisId,
            ComparisonBasis basis,
            ReportRef previous,
            ReportRef current,
            @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss") LocalDateTime completedAt) {

        static Item from(CompletedAnalysis c) {
            return new Item(c.analysis().getId(), c.analysis().getBasis(),
                    ReportRef.from(c.previous()), ReportRef.from(c.current()),
                    c.analysis().getCompletedAt());
        }
    }

    public record ReportRef(String rceptNo, String reportName, LocalDate periodEnd) {

        static ReportRef from(Report report) {
            return new ReportRef(report.getRceptNo(), report.getReportName(), report.getPeriodEnd());
        }
    }
}
