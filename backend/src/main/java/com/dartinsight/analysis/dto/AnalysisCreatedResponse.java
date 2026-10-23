package com.dartinsight.analysis.dto;

import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.domain.AnalysisStatus;
import com.dartinsight.analysis.domain.AnalysisStep;
import com.dartinsight.analysis.service.AnalysisService;

public record AnalysisCreatedResponse(Long analysisId, AnalysisStatus status, AnalysisStep step, boolean reused) {

    public static AnalysisCreatedResponse from(AnalysisService.RequestResult result) {
        Analysis a = result.analysis();
        return new AnalysisCreatedResponse(a.getId(), a.getStatus(), a.getStep(), result.reused());
    }
}
