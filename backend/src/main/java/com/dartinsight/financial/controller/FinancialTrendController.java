package com.dartinsight.financial.controller;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.web.ApiPaths;
import com.dartinsight.financial.domain.FsDiv;
import com.dartinsight.financial.dto.FinancialTrendResponse;
import com.dartinsight.financial.service.FinancialTrendService;
import java.util.Arrays;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 주요 재무 흐름 API(docs/api-spec.md). 기업 화면 '기업 개요' 탭(1.2, FS-46).
 */
@RestController
@RequestMapping(ApiPaths.COMPANY_FINANCIAL_TRENDS)
@RequiredArgsConstructor
public class FinancialTrendController {

    private final FinancialTrendService trendService;

    @GetMapping
    public FinancialTrendResponse get(@PathVariable String corpCode,
            @RequestParam(defaultValue = "CFS") String fsDiv,
            @RequestParam(defaultValue = "" + FinancialTrendService.DEFAULT_LIMIT) String limit) {
        FsDiv selected = Arrays.stream(FsDiv.values()).filter(d -> d.name().equals(fsDiv)).findFirst()
                .orElseThrow(() -> ApiException.invalidInput("fsDiv", "CFS 또는 OFS여야 합니다."));
        return FinancialTrendResponse.from(trendService.trend(corpCode, selected, parseLimit(limit)));
    }

    private static int parseLimit(String text) {
        try {
            int limit = Integer.parseInt(text.trim());
            if (limit >= 1 && limit <= FinancialTrendService.MAX_LIMIT) {
                return limit;
            }
        } catch (NumberFormatException e) {
            // 아래에서 입력값 오류로 돌려준다
        }
        throw ApiException.invalidInput("limit", "1~" + FinancialTrendService.MAX_LIMIT + " 사이의 정수여야 합니다.");
    }
}
