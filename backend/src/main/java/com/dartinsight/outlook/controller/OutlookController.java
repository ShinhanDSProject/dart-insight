package com.dartinsight.outlook.controller;

import com.dartinsight.common.web.ApiPaths;
import com.dartinsight.outlook.dto.CompanyOutlookResponse;
import com.dartinsight.outlook.service.OutlookService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 회사가 밝힌 전망·계획 API(docs/api-spec.md GET /api/companies/{corpCode}/outlook, ADR-0039). 기업 화면 개요 탭.
 */
@RestController
@RequestMapping(ApiPaths.COMPANY_OUTLOOK)
@RequiredArgsConstructor
public class OutlookController {

    private final OutlookService outlookService;

    @GetMapping
    public CompanyOutlookResponse get(@PathVariable String corpCode) {
        return outlookService.get(corpCode);
    }
}
