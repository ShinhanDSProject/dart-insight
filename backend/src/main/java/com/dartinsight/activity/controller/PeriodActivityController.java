package com.dartinsight.activity.controller;

import com.dartinsight.activity.dto.PeriodActivityResponse;
import com.dartinsight.activity.service.PeriodActivityService;
import com.dartinsight.common.web.ApiPaths;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 두 보고서 사이에 회사가 한 일과 앞으로의 영향(docs/api-spec.md GET /api/analyses/{analysisId}/activities, ADR-0067). */
@RestController
@RequestMapping(ApiPaths.ANALYSES)
@RequiredArgsConstructor
public class PeriodActivityController {

    private final PeriodActivityService periodActivityService;

    @GetMapping(ApiPaths.ANALYSIS_ACTIVITIES)
    public PeriodActivityResponse get(@PathVariable Long analysisId) {
        return periodActivityService.get(analysisId);
    }
}
