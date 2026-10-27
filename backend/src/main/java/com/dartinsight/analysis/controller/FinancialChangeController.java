package com.dartinsight.analysis.controller;

import com.dartinsight.analysis.dto.FinancialChangeDetailResponse;
import com.dartinsight.analysis.dto.FinancialChangeListResponse;
import com.dartinsight.analysis.service.FinancialChangeQueryService.FinancialChangeEvidence;
import com.dartinsight.analysis.service.FinancialChangeQueryService;
import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.web.ApiPaths;
import com.dartinsight.financial.domain.StatementType;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 재무 수치 변화 조회 API(docs/api-spec.md). 화면 W-03 ②와 수치 근거 상세(3.3). 완료된 분석의 결과만 돌려준다.
 */
@RestController
@RequestMapping(ApiPaths.ANALYSIS_FINANCIAL_CHANGES)
@RequiredArgsConstructor
public class FinancialChangeController {

    private final FinancialChangeQueryService queryService;

    @GetMapping
    public FinancialChangeListResponse list(@PathVariable Long analysisId,
            @RequestParam(defaultValue = "BS") String sjDiv,
            @RequestParam(defaultValue = "false") boolean changedOnly) {
        StatementType selected = StatementType.of(sjDiv)
                .orElseThrow(() -> ApiException.invalidInput("sjDiv", "BS, IS, CIS, CF, SCE 중 하나여야 합니다."));
        return FinancialChangeListResponse.of(analysisId, selected, changedOnly, queryService.changes(analysisId));
    }

    @GetMapping(ApiPaths.BY_CHANGE_ID)
    public FinancialChangeDetailResponse detail(@PathVariable Long analysisId, @PathVariable Long changeId) {
        FinancialChangeEvidence evidence = queryService.change(analysisId, changeId);
        return FinancialChangeDetailResponse.of(evidence.change(), evidence.previous(), evidence.current());
    }
}
