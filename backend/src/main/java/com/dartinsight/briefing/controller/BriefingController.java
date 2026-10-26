package com.dartinsight.briefing.controller;

import com.dartinsight.briefing.dto.CompanyBriefingResponse;
import com.dartinsight.briefing.service.BriefingService;
import com.dartinsight.common.web.ApiPaths;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * AI 기업 브리핑 API(docs/api-spec.md GET /api/companies/{corpCode}/briefing, ADR-0025). 기업 화면 개요 탭.
 */
@RestController
@RequestMapping(ApiPaths.COMPANY_BRIEFING)
@RequiredArgsConstructor
public class BriefingController {

    private final BriefingService briefingService;

    @GetMapping
    public CompanyBriefingResponse get(@PathVariable String corpCode) {
        return briefingService.get(corpCode);
    }
}
