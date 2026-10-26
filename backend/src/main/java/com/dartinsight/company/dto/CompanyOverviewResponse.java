package com.dartinsight.company.dto;

import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.company.domain.CompanyOverview;
import com.dartinsight.dart.domain.CacheResult;
import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 기업 개황(docs/api-spec.md GET /api/companies/{corpCode}/overview). OpenDART company.json 값을 그대로 담는다.
 *
 * @param available    OpenDART에 자료가 있는지. 013(자료 없음)이면 false이고 개황 필드는 모두 null
 * @param refreshError 다시 받지 못해 저장된 값을 돌려줄 때 그 이유
 */
public record CompanyOverviewResponse(
        String corpCode,
        boolean available,
        String corpName,
        String corpNameEng,
        String stockName,
        String stockCode,
        String ceoName,
        String corpClass,
        String indutyCode,
        LocalDate establishedDate,
        Integer accountingMonth,
        String homepageUrl,
        String irUrl,
        String address,
        String phoneNumber,
        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss") LocalDateTime fetchedAt,
        ErrorCode refreshError) {

    public static CompanyOverviewResponse from(CacheResult<CompanyOverview> result) {
        CompanyOverview o = result.value();
        return new CompanyOverviewResponse(o.getCorpCode(), o.isAvailable(), o.getCorpName(), o.getCorpNameEng(),
                o.getStockName(), o.getStockCode(), o.getCeoName(), o.getCorpClass(), o.getIndutyCode(),
                o.getEstablishedDate(), o.getAccountingMonth(), o.getHomepageUrl(), o.getIrUrl(), o.getAddress(),
                o.getPhoneNumber(), o.getFetchedAt(), result.refreshError());
    }
}
