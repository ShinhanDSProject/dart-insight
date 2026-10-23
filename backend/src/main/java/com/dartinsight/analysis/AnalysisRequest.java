package com.dartinsight.analysis;

import com.dartinsight.comparison.domain.ComparisonBasis;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record AnalysisRequest(
        @NotBlank(message = "기업 고유번호가 필요합니다.") String corpCode,
        @NotBlank(message = "현재 보고서 접수번호가 필요합니다.") String currentRceptNo,
        @NotBlank(message = "비교 보고서 접수번호가 필요합니다.") String previousRceptNo,
        @NotNull(message = "비교 기준이 필요합니다.") ComparisonBasis basis) {
}
