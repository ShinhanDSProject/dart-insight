package com.dartinsight.analysis;

public record AnalysisCreatedResponse(Long analysisId, AnalysisStatus status, AnalysisStep step, boolean reused) {

    static AnalysisCreatedResponse from(AnalysisService.RequestResult result) {
        Analysis a = result.analysis();
        return new AnalysisCreatedResponse(a.getId(), a.getStatus(), a.getStep(), result.reused());
    }
}
