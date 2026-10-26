package com.dartinsight.company.controller;

import com.dartinsight.common.web.ApiPaths;
import com.dartinsight.company.dto.CompanyOverviewResponse;
import com.dartinsight.company.dto.CompanyResponse;
import com.dartinsight.company.dto.CompanySearchResponse;
import com.dartinsight.company.service.CompanyOverviewService;
import com.dartinsight.company.service.CompanyService;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 기업 검색·조회 API(docs/api-spec.md). 화면 W-01 ①.
 */
@RestController
@RequestMapping(ApiPaths.COMPANIES)
@RequiredArgsConstructor
public class CompanyController {

    private final CompanyService companyService;
    private final CompanyOverviewService companyOverviewService;

    @GetMapping
    public CompanySearchResponse search(
            @RequestParam String query,
            @RequestParam(defaultValue = "20") @Min(value = 1, message = "1 이상이어야 합니다.")
            @Max(value = 50, message = "50 이하여야 합니다.") int limit) {
        return CompanySearchResponse.from(companyService.search(query, limit));
    }

    @GetMapping(ApiPaths.BY_CORP_CODE)
    public CompanyResponse get(@PathVariable String corpCode) {
        return CompanyResponse.from(companyService.get(corpCode));
    }

    /** 기업 개황(FS-45). 저장된 값이 7일 안이면 OpenDART를 부르지 않는다(ADR-0024). */
    @GetMapping(ApiPaths.COMPANY_OVERVIEW)
    public CompanyOverviewResponse overview(@PathVariable String corpCode) {
        return CompanyOverviewResponse.from(companyOverviewService.get(corpCode));
    }
}
