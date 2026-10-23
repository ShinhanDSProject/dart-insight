package com.dartinsight.company;

import java.util.List;

public record CompanySearchResponse(List<CompanyResponse> items) {

    static CompanySearchResponse from(List<Company> companies) {
        return new CompanySearchResponse(companies.stream().map(CompanyResponse::from).toList());
    }
}
