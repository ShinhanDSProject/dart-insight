package com.dartinsight.analysis.dto;

import com.dartinsight.analysis.domain.TextChangeRow;
import com.dartinsight.analysis.domain.TextSectionCount;
import com.dartinsight.analysis.domain.TextStatus;
import java.util.List;
import java.util.Map;

/** section·q는 요청에 쓴 거르기 값(없으면 null). sections는 고를 수 있는 최상위 섹션과 건수 */
public record TextChangeListResponse(Long analysisId, TextStatus textStatus, String textMessage, String type,
        String sort, String section, String q, int page, int size, int totalItems, Counts counts,
        List<SectionView> sections, List<TextChangeItemResponse> items) {

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
