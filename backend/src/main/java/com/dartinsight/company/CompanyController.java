package com.dartinsight.company;

import com.dartinsight.common.web.ApiPaths;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
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
public class CompanyController {

    private final CompanyService companyService;

    public CompanyController(CompanyService companyService) {
        this.companyService = companyService;
    }

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
}
