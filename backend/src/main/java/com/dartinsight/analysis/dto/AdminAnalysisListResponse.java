package com.dartinsight.analysis.dto;

import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.domain.AnalysisListing;
import com.dartinsight.analysis.domain.AnalysisPage;
import com.dartinsight.analysis.domain.AnalysisStatus;
import com.dartinsight.analysis.domain.AnalysisStep;
import com.dartinsight.comparison.domain.ComparisonBasis;
import com.dartinsight.report.domain.Report;
import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalDateTime;
import java.util.List;

/** 관리자 분석 작업 목록(docs/api-spec.md GET /api/admin/analyses) */
public record AdminAnalysisListResponse(int page, int size, long totalItems, List<Item> items) {

    public static AdminAnalysisListResponse from(AnalysisPage page) {
        return new AdminAnalysisListResponse(page.page(), page.size(), page.totalItems(),
                page.items().stream().map(Item::from).toList());
    }

    /**
     * @param traceId 요청 추적 ID(request_trace_id). 없으면 null
     * @param durationSeconds 완료·실패까지 걸린 초. 진행 중이거나 시작 전이면 null
     */
    public record Item(long analysisId, String corpCode, String corpName, ComparisonBasis basis, ReportRef current,
            ReportRef previous, AnalysisStatus status, AnalysisStep step, String errorCode, String errorMessage,
            String traceId, String analysisVersion, boolean outdated,
            @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss") LocalDateTime createdAt,
            @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss") LocalDateTime startedAt,
            @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss") LocalDateTime completedAt,
            Long durationSeconds) {

        static Item from(AnalysisListing listing) {
            Analysis a = listing.analysis();
            return new Item(a.getId(), a.getCorpCode(), listing.corpName(), a.getBasis(),
                    ReportRef.of(a.getCurrentRceptNo(), listing.current()),
                    ReportRef.of(a.getPreviousRceptNo(), listing.previous()),
                    a.getStatus(), a.getStep(), a.getErrorCode(), a.getErrorMessage(), a.getRequestTraceId(),
                    a.getAnalysisVersion(), a.isOutdated(), a.getCreatedAt(), a.getStartedAt(), a.getCompletedAt(),
                    a.durationSeconds());
        }
    }

    /** @param reportName 보고서가 저장돼 있지 않으면 null */
    public record ReportRef(String rceptNo, String reportName) {

        static ReportRef of(String rceptNo, Report report) {
            return new ReportRef(rceptNo, report == null ? null : report.getReportName());
        }
    }
}
