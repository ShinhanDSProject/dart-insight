package com.dartinsight.featured.controller;

import com.dartinsight.common.web.ApiPaths;
import com.dartinsight.featured.dto.FeaturedCompanyListResponse;
import com.dartinsight.featured.service.FeaturedCompanyService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 첫 화면 대표 기업 API(docs/api-spec.md, ADR-0033). 화면 W-01 ①. 로그인 없이 쓴다.
 */
@RestController
@RequestMapping(ApiPaths.FEATURED_COMPANIES)
@RequiredArgsConstructor
public class FeaturedCompanyController {

    private final FeaturedCompanyService featuredCompanyService;

    @GetMapping
    public FeaturedCompanyListResponse list() {
        return featuredCompanyService.list();
    }
}
