package com.dartinsight.analysis.dto;

import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.domain.TextChangeFilter;
import com.dartinsight.analysis.domain.TextChangeListing;
import com.dartinsight.analysis.domain.TextChangeRow;
import com.dartinsight.analysis.domain.TextSectionCount;
import com.dartinsight.analysis.domain.TextStatus;
import com.dartinsight.analysis.service.TextChangeQueryService.TextChangePage;
import java.util.List;
import java.util.Map;

/**
 * section·q·group·field는 요청에 쓴 거르기 값(없으면 null). sections는 고를 수 있는 최상위 섹션과 건수.
 * listVersion·fieldCounts·missingFields·groupCounts는 분석 전체의 분류 값이고, 분류 전에 만든 분석이면 null이다(ADR-0047)
 */
public record TextChangeListResponse(Long analysisId, TextStatus textStatus, String textMessage, String type,
        String sort, String section, String q, boolean risk, int page, int size, int totalItems, Counts counts,
        Counts riskCounts, String group, String field, String listVersion, Map<String, Integer> fieldCounts,
        List<String> missingFields, Map<String, Integer> groupCounts, List<SectionView> sections,
        List<TextChangeItemResponse> items) {

    /** 목록 한 쪽. type·group은 고른 값을 쉼표로 이은 값이다. */
    public static TextChangeListResponse of(Long analysisId, String sort, int page, int size, TextChangePage result) {
        Analysis analysis = result.analysis();
        TextChangeFilter filter = result.filter();
        TextChangeListing.Summary listing = result.listing();
        List<SectionView> sections = result.sections().stream().map(SectionView::from).toList();
        List<TextChangeItemResponse> items = result.changes().stream().map(TextChangeItemResponse::from).toList();
        return new TextChangeListResponse(analysisId, analysis.getTextStatus(), analysis.getTextMessage(),
                joined(filter.types()), sort, filter.section(), filter.q(), filter.risk(), page, size,
                result.totalItems(), Counts.of(result.counts()), Counts.of(result.riskCounts()),
                joined(filter.groups()), filter.field(), listing == null ? null : listing.version(),
                listing == null ? null : listing.fieldCounts(), listing == null ? null : listing.missingFields(),
                listing == null ? null : listing.groupCounts(), sections, items);
    }

    private static String joined(List<String> values) {
        return values.isEmpty() ? null : String.join(TextChangeFilter.TYPE_SEPARATOR, values);
    }

    public record Counts(int all, int added, int deleted, int modified, int numericUpdate, int moved,
            int reviewNeeded) {

        /** @param counts 변경 종류 → 개수 */
        public static Counts of(Map<String, Integer> counts) {
            return new Counts(counts.values().stream().mapToInt(Integer::intValue).sum(),
                    counts.get(TextChangeRow.ADDED), counts.get(TextChangeRow.DELETED),
                    counts.get(TextChangeRow.MODIFIED), counts.get(TextChangeRow.NUMERIC_UPDATE),
                    counts.get(TextChangeRow.MOVED), counts.get(TextChangeRow.REVIEW_NEEDED));
        }
    }

    /** 최상위 섹션 하나. count는 유형·검색에 맞는 건수(0일 수 있음) */
    public record SectionView(String title, int count) {

        public static SectionView from(TextSectionCount section) {
            return new SectionView(section.title(), section.count());
        }
    }
}
