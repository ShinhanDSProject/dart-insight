package com.dartinsight.comparison;

import com.dartinsight.common.web.ApiPaths;
import com.dartinsight.comparison.ComparabilityService.ComparabilityResult;
import com.dartinsight.report.service.ReportService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 비교 가능성 검증 API(docs/api-spec.md). 화면 W-01 ③.
 * 비교할 수 없어도 200으로 결과를 돌려준다(분석 요청만 422).
 */
@RestController
@RequestMapping(ApiPaths.COMPARABILITY_CHECKS)
@RequiredArgsConstructor
public class ComparabilityController {

    private final ComparabilityService comparabilityService;
    private final ReportService reportService;

    @PostMapping
    public ComparabilityResponse check(@Valid @RequestBody ComparabilityRequest request) {
        ComparabilityResult result = comparabilityService.check(request.corpCode(), request.currentRceptNo(),
                request.previousRceptNo(), request.basis());
        return ComparabilityResponse.from(result, reportService.financialDataStatuses(request.corpCode(),
                List.of(result.current(), result.previous())));
    }
}
