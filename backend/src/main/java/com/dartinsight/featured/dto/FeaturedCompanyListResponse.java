package com.dartinsight.featured.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * 첫 화면 대표 기업(docs/api-spec.md). 아직 받지 못했으면 baseDate는 null, items는 빈 목록.
 *
 * @param source 화면에 함께 보일 출처(공공누리 제4유형 출처표시)
 */
public record FeaturedCompanyListResponse(LocalDate baseDate, String source, List<FeaturedCompanyResponse> items) {

    public static final String SOURCE = "금융위원회, 공공데이터포털";
}
