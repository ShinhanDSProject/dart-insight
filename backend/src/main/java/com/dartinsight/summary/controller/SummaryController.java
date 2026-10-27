package com.dartinsight.summary.controller;

import com.dartinsight.common.web.ApiPaths;
import com.dartinsight.summary.dto.SummaryResponse;
import com.dartinsight.summary.service.SummaryViewService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 요약·설명(3.2). 화면 W-03 ①. 근거를 확인한 항목만 요약에 보이고, 확인하지 못한 항목은 '검토 필요'로 따로 센다.
 * AI가 만든 문장에는 aiGenerated와 모델·프롬프트 버전·생성 시각이 함께 있다.
 */
@RestController
@RequestMapping(ApiPaths.ANALYSIS_SUMMARY)
@RequiredArgsConstructor
public class SummaryController {

    private final SummaryViewService viewService;

    @GetMapping
    public SummaryResponse summary(@PathVariable Long analysisId) {
        return viewService.summary(analysisId);
    }
}
