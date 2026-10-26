package com.dartinsight.favorite.dto;

import com.dartinsight.company.domain.Company;
import com.dartinsight.favorite.domain.FavoriteCompany;
import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalDateTime;

/** 관심 기업 한 곳. 기업 필드는 GET /api/companies의 항목과 같다(docs/api-spec.md). */
public record FavoriteCompanyResponse(
        String corpCode,
        String corpName,
        String stockCode,
        boolean listed,
        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss") LocalDateTime addedAt) {

    public static FavoriteCompanyResponse of(FavoriteCompany favorite, Company company) {
        return new FavoriteCompanyResponse(company.getCorpCode(), company.getCorpName(), company.getStockCode(),
                company.isListed(), favorite.getCreatedAt());
    }
}
