package com.dartinsight.analysis.controller;

import com.dartinsight.analysis.dto.AdminAnalysisListResponse;
import com.dartinsight.analysis.service.AnalysisMonitorService;
import com.dartinsight.common.web.ApiPaths;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 관리자 분석 작업 목록(docs/api-spec.md GET /api/admin/analyses, FS-72). 관리자인지는 SecurityConfig가 확인한다(ADR-0040). */
@RestController
@RequestMapping(ApiPaths.ADMIN_ANALYSES)
@RequiredArgsConstructor
public class AdminAnalysisController {
    private final AnalysisMonitorService analysisMonitorService;

    @GetMapping
    public AdminAnalysisListResponse list(@RequestParam(required = false) String status,
            @RequestParam(required = false) Integer days, @RequestParam(required = false) String q,
            @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        return AdminAnalysisListResponse.from(analysisMonitorService.search(status, days, q, page, size));
    }
}
