package com.dartinsight.featured.dto;

import com.dartinsight.company.domain.Company;
import com.dartinsight.featured.domain.FeaturedCompany;

/** 대표 기업 한 곳. 시가총액은 넣지 않는다(ADR-0033). */
public record FeaturedCompanyResponse(int rank, String corpCode, String corpName, String stockCode) {

    public static FeaturedCompanyResponse of(FeaturedCompany featured, Company company) {
        return new FeaturedCompanyResponse(featured.getRankNo(), company.getCorpCode(), company.getCorpName(),
                company.getStockCode());
    }
}
