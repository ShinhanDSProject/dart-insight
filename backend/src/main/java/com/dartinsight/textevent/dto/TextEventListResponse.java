package com.dartinsight.textevent.dto;

import com.dartinsight.analysis.domain.TextChange;
import com.dartinsight.analysis.domain.TextChangeListing;
import com.dartinsight.analysis.domain.TextChangeRow;
import com.dartinsight.analysis.domain.TextPreview;
import com.dartinsight.textevent.domain.TextEvents;
import com.dartinsight.textevent.service.TextEventQueryService.EventList;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 주요 사건 목록.
 *
 * @param fieldCounts    칸마다 관련 사건을 한 번만 센다. 칸을 더한 값은 사건 수와 다를 수 있다
 * @param unboundChanges 후보였지만 어느 사건에도 들어가지 않은 변경
 */
public record TextEventListResponse(long analysisId, String eventVersion, LocalDateTime generatedAt,
        int droppedEventCount, List<FieldCount> fieldCounts, List<TextEventItemResponse> items,
        List<UnboundChange> unboundChanges) {

    public static TextEventListResponse from(EventList list) {
        List<TextEventItemResponse> items = list.events().stream()
                .map(event -> TextEventItemResponse.of(event, list.changes())).toList();
        return new TextEventListResponse(list.analysisId(), TextEvents.EVENT_VERSION,
                items.isEmpty() ? null : items.getFirst().generatedAt(), list.droppedEventCount(), fieldCounts(items),
                items, list.unboundChangeNos().stream().map(no -> UnboundChange.from(list.changes().get(no))).toList());
    }

    private static List<FieldCount> fieldCounts(List<TextEventItemResponse> items) {
        return TextChangeListing.FIELDS.stream()
                .map(field -> new FieldCount(field,
                        (int) items.stream().filter(item -> item.fields().contains(field)).count()))
                .filter(count -> count.eventCount() > 0)
                .toList();
    }

    public record FieldCount(String field, int eventCount) {
    }

    public record UnboundChange(long changeId, String changeType, String field, String sectionPath,
            String previousPreview, String currentPreview) {

        static UnboundChange from(TextChange change) {
            TextChangeRow row = change.row();
            String previous = row.previous() == null ? null : row.previous().text();
            String current = row.current() == null ? null : row.current().text();
            int from = TextPreview.firstDifference(previous, current);
            return new UnboundChange(change.id(), row.changeType(),
                    row.listing() == null ? null : row.listing().field(), row.sectionPath(),
                    TextPreview.cut(previous, from), TextPreview.cut(current, from));
        }
    }
}
