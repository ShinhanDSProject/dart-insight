package com.dartinsight.dart.domain;

import java.time.LocalDate;

/**
 * 기업개황(company.json) 한 건. 문자열은 앞뒤 공백을 지우고 빈 값은 null이다. 날짜·월이 형식에 맞지 않으면 null이다.
 *
 * @param corpClass       법인구분(corp_cls). Y 유가증권시장, K 코스닥, N 코넥스, E 기타
 * @param accountingMonth 결산월(acc_mt) 1~12
 */
public record CompanyOverviewEntry(
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
        String phoneNumber) {
}
