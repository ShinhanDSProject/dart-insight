package com.dartinsight.analysis.dto;

import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.domain.TextChangeFilter;
import com.dartinsight.analysis.domain.TextChangeRow;
import com.dartinsight.analysis.domain.TextSectionCount;
import com.dartinsight.analysis.domain.TextStatus;
import com.dartinsight.analysis.service.TextChangeQueryService.TextChangePage;
import java.util.List;
import java.util.Map;

/** section·q는 요청에 쓴 거르기 값(없으면 null). sections는 고를 수 있는 최상위 섹션과 건수 */
public record TextChangeListResponse(Long analysisId, TextStatus textStatus, String textMessage, String type,
        String sort, String section, String q, int page, int size, int totalItems, Counts counts,
        List<SectionView> sections, List<TextChangeItemResponse> items) {

    /**
     * 목록 한 쪽. totalItems는 고른 유형 건수의 합(유형을 고르지 않았으면 전체), type은 고른 유형을 쉼표로 이은 값.
     *
     * @param filter 요청에 쓴 거르기(유형·섹션·검색어)
     */
    public static TextChangeListResponse of(Long analysisId, TextChangeFilter filter, String sort, int page,
            int size, TextChangePage result) {
        Analysis analysis = result.analysis();
        List<String> types = filter.types();
        Counts counts = Counts.of(result.counts());
        int total = types.isEmpty() ? counts.all() : types.stream().mapToInt(result.counts()::get).sum();
        List<SectionView> sections = result.sections().stream().map(SectionView::from).toList();
        List<TextChangeItemResponse> items = result.changes().stream().map(TextChangeItemResponse::from).toList();
        String typeEcho = types.isEmpty() ? null : String.join(TextChangeFilter.TYPE_SEPARATOR, types);
        return new TextChangeListResponse(analysisId, analysis.getTextStatus(), analysis.getTextMessage(), typeEcho,
                sort, filter.section(), filter.q(), page, size, total, counts, sections, items);
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
