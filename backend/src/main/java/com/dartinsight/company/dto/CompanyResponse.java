package com.dartinsight.company.dto;

import com.dartinsight.company.domain.Company;

public record CompanyResponse(String corpCode, String corpName, String stockCode, boolean listed) {

    public static CompanyResponse from(Company company) {
        return new CompanyResponse(company.getCorpCode(), company.getCorpName(), company.getStockCode(),
                company.isListed());
    }
}
