package com.dartinsight.analysis.controller;

import com.dartinsight.analysis.dto.CompanyAnalysisListResponse;
import com.dartinsight.analysis.service.CompanyAnalysisService;
import com.dartinsight.common.web.ApiPaths;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 기업의 이미 분석한 비교 API(docs/api-spec.md). 화면 W-01 ②.
 */
@RestController
@RequestMapping(ApiPaths.COMPANY_ANALYSES)
@RequiredArgsConstructor
public class CompanyAnalysisController {

    private final CompanyAnalysisService companyAnalysisService;

    @GetMapping
    public CompanyAnalysisListResponse list(@PathVariable String corpCode,
            @RequestParam(defaultValue = "5") @Min(value = 1, message = "1 이상이어야 합니다.")
            @Max(value = 20, message = "20 이하여야 합니다.") int limit) {
        return CompanyAnalysisListResponse.from(companyAnalysisService.recentCompleted(corpCode, limit));
    }
}
