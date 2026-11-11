package com.dartinsight.stats.dto;

import com.dartinsight.stats.domain.ServiceStats;
import java.time.LocalDateTime;

/** GET /api/stats 응답(docs/api-spec.md) */
public record ServiceStatsResponse(long listedCompanies, long completedAnalyses, long textChanges,
        LocalDateTime countedAt) {

    public static ServiceStatsResponse from(ServiceStats stats) {
        return new ServiceStatsResponse(stats.listedCompanies(), stats.completedAnalyses(), stats.textChanges(),
                stats.countedAt());
    }
}
