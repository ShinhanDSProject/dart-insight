package com.dartinsight.report;

import com.dartinsight.common.error.ErrorCode;
import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalDateTime;
import java.util.List;

/**
 * @param refreshError OpenDART에서 다시 받지 못해 저장된 목록을 돌려줄 때 그 이유
 */
public record ReportListResponse(
        String corpCode,
        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss") LocalDateTime fetchedAt,
        ErrorCode refreshError,
        List<ReportItemResponse> items) {

    static ReportListResponse from(String corpCode, ReportService.ReportList list) {
        return new ReportListResponse(
                corpCode,
                list.company().getReportsFetchedAt(),
                list.refreshError(),
                list.reports().stream()
                        .map(r -> ReportItemResponse.from(r, list.financialDataStatuses().get(r.getRceptNo())))
                        .toList());
    }
}
