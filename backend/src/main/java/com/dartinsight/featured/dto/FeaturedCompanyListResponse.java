package com.dartinsight.featured.dto;

import com.dartinsight.company.domain.Company;
import com.dartinsight.featured.domain.FeaturedCompany;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * 첫 화면 대표 기업(docs/api-spec.md). 아직 받지 못했으면 baseDate는 null, items는 빈 목록.
 *
 * @param source 화면에 함께 보일 출처(공공누리 제4유형 출처표시)
 */
public record FeaturedCompanyListResponse(LocalDate baseDate, String source, List<FeaturedCompanyResponse> items) {

    public static final String SOURCE = "금융위원회, 공공데이터포털";

    /**
     * 순위 순서의 저장된 목록. 우리 기업 목록에 없는 기업은 뺀다. 기준일은 첫 행의 것이다.
     *
     * @param companies 고유번호 → 기업
     */
    public static FeaturedCompanyListResponse of(List<FeaturedCompany> rows, Map<String, Company> companies) {
        List<FeaturedCompanyResponse> items = rows.stream()
                .filter(row -> companies.containsKey(row.getCorpCode()))
                .map(row -> FeaturedCompanyResponse.of(row, companies.get(row.getCorpCode())))
                .toList();
        LocalDate baseDate = rows.isEmpty() ? null : rows.get(0).getBaseDate();
        return new FeaturedCompanyListResponse(baseDate, SOURCE, items);
    }
}
