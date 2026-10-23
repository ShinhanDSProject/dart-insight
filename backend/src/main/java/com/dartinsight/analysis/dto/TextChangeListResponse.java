package com.dartinsight.analysis.dto;

import com.dartinsight.analysis.domain.TextChangeRow;
import com.dartinsight.analysis.domain.TextStatus;
import java.util.List;
import java.util.Map;

public record TextChangeListResponse(Long analysisId, TextStatus textStatus, String textMessage, String type,
        String sort, int page, int size, int totalItems, Counts counts, List<TextChangeItemResponse> items) {

    public record Counts(int all, int added, int deleted, int modified, int reviewNeeded) {

        /** @param counts 변경 종류 → 개수(분석 전체) */
        public static Counts of(Map<String, Integer> counts) {
            return new Counts(counts.values().stream().mapToInt(Integer::intValue).sum(),
                    counts.get(TextChangeRow.ADDED), counts.get(TextChangeRow.DELETED),
                    counts.get(TextChangeRow.MODIFIED), counts.get(TextChangeRow.REVIEW_NEEDED));
        }
    }
}
