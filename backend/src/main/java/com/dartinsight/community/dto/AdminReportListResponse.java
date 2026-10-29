package com.dartinsight.community.dto;

import java.util.List;

/** GET /api/admin/reports 응답 */
public record AdminReportListResponse(String queue, int page, int size, long totalItems,
        List<AdminReportResponse> items) {}
