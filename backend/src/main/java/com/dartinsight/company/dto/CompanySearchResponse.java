package com.dartinsight.company.dto;

import com.dartinsight.company.domain.Company;
import java.util.List;

public record CompanySearchResponse(List<CompanyResponse> items) {

    public static CompanySearchResponse from(List<Company> companies) {
        return new CompanySearchResponse(companies.stream().map(CompanyResponse::from).toList());
    }
}
