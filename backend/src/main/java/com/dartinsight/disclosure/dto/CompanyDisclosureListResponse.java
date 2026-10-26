package com.dartinsight.disclosure.dto;

import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.disclosure.domain.DisclosureGroup;
import com.dartinsight.disclosure.service.DisclosureService.DisclosureTimeline;
import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;

/**
 * 최근 공시 타임라인 응답(docs/api-spec.md GET /api/companies/{corpCode}/disclosures).
 *
 * @param refreshError OpenDART에서 다시 받지 못해 저장된 목록을 돌려줄 때 그 이유
 * @param groups       묶음별 건수. 모든 묶음을 정해진 순서로 넣는다(0건 포함)
 */
public record CompanyDisclosureListResponse(
        String corpCode,
        int days,
        LocalDate from,
        LocalDate to,
        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss") LocalDateTime fetchedAt,
        ErrorCode refreshError,
        List<GroupCount> groups,
        List<CompanyDisclosureItemResponse> items) {

    public record GroupCount(DisclosureGroup group, String label, int count) {
    }

    public static CompanyDisclosureListResponse from(DisclosureTimeline timeline) {
        return new CompanyDisclosureListResponse(
                timeline.corpCode(),
                timeline.days(),
                timeline.from(),
                timeline.to(),
                timeline.fetchedAt(),
                timeline.refreshError(),
                Arrays.stream(DisclosureGroup.values())
                        .map(g -> new GroupCount(g, g.label(), timeline.counts().getOrDefault(g, 0)))
                        .toList(),
                timeline.items().stream().map(CompanyDisclosureItemResponse::from).toList());
    }
}
