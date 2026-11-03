package com.dartinsight.news.controller;

import com.dartinsight.common.web.ApiPaths;
import com.dartinsight.news.dto.CompanyNewsResponse;
import com.dartinsight.news.service.CompanyNewsService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 기업 뉴스 API(docs/api-spec.md, #592, ADR-0046). 화면: 분석 결과 '뉴스' 탭.
 */
@RestController
@RequestMapping(ApiPaths.COMPANY_NEWS)
@RequiredArgsConstructor
public class CompanyNewsController {

    private final CompanyNewsService companyNewsService;

    @GetMapping
    public CompanyNewsResponse news(@PathVariable String corpCode) {
        return CompanyNewsResponse.from(companyNewsService.news(corpCode));
    }
}
