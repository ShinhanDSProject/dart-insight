package com.dartinsight.analysis;

import com.dartinsight.analysis.TextChangeStore.TextChange;
import com.dartinsight.common.error.ApiException;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 문장·표 변경 목록(2.5). 화면 W-03 ③. 완료된 분석의 그 분석 결과만 돌려준다.
 */
@RestController
public class TextChangeController {

    private static final Set<String> TYPES = Set.of(TextChangeRow.ADDED, TextChangeRow.DELETED,
            TextChangeRow.MODIFIED, TextChangeRow.REVIEW_NEEDED);
    private static final int MAX_SIZE = 100;

    private final AnalysisResultService resultService;
    private final TextChangeStore store;

    public TextChangeController(AnalysisResultService resultService, TextChangeStore store) {
        this.resultService = resultService;
        this.store = store;
    }

    @GetMapping("/api/analyses/{analysisId}/text-changes")
    public TextChangeListResponse list(@PathVariable Long analysisId,
            @RequestParam(required = false) String type,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        if (type != null && !TYPES.contains(type)) {
            throw ApiException.invalidInput("type", "ADDED, DELETED, MODIFIED, REVIEW_NEEDED 중 하나여야 합니다.");
        }
        if (page < 0) {
            throw ApiException.invalidInput("page", "0 이상이어야 합니다.");
        }
        if (size < 1 || size > MAX_SIZE) {
            throw ApiException.invalidInput("size", "1에서 " + MAX_SIZE + " 사이여야 합니다.");
        }
        Analysis analysis = resultService.completed(analysisId);
        Map<String, Integer> counts = store.counts(analysisId);
        int all = counts.values().stream().mapToInt(Integer::intValue).sum();
        Counts countView = new Counts(all, counts.get(TextChangeRow.ADDED), counts.get(TextChangeRow.DELETED),
                counts.get(TextChangeRow.MODIFIED), counts.get(TextChangeRow.REVIEW_NEEDED));
        int total = type == null ? all : counts.get(type);
        List<TextChangeItem> items = store.page(analysisId, type, page * size, size).stream()
                .map(TextChangeController::item).toList();
        return new TextChangeListResponse(analysisId, analysis.getTextStatus(), analysis.getTextMessage(), type,
                page, size, total, countView, items);
    }

    static TextChangeItem item(TextChange change) {
        TextChangeRow row = change.row();
        String previous = row.previous() == null ? null : row.previous().text();
        String current = row.current() == null ? null : row.current().text();
        int from = TextPreview.firstDifference(previous, current);
        return new TextChangeItem(change.id(), change.changeNo(), row.changeType(), row.blockType(),
                row.numbersOnly(), row.sectionStatus(), row.sectionTitle(), row.sectionPath(),
                TextPreview.cut(previous, from), TextPreview.cut(current, from), row.similarity(),
                row.reviewReason());
    }

    public record Counts(int all, int added, int deleted, int modified, int reviewNeeded) {
    }

    /** previewText는 앞부분만(수정이면 처음 달라지는 곳부터). 전체 글은 상세(3.4)에서 본다. */
    public record TextChangeItem(long changeId, int changeNo, String changeType, String blockType,
            boolean numbersOnly, String sectionStatus, String sectionTitle, String sectionPath,
            String previousPreview, String currentPreview, BigDecimal similarity, String reviewReason) {
    }

    public record TextChangeListResponse(Long analysisId, TextStatus textStatus, String textMessage, String type,
            int page, int size, int totalItems, Counts counts, List<TextChangeItem> items) {
    }
}
