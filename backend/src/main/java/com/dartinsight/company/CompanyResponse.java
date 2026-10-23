package com.dartinsight.company;

public record CompanyResponse(String corpCode, String corpName, String stockCode, boolean listed) {

    static CompanyResponse from(Company company) {
        return new CompanyResponse(company.getCorpCode(), company.getCorpName(), company.getStockCode(),
                company.isListed());
    }
}
