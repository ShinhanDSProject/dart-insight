package com.dartinsight.textevent.dto;

import com.dartinsight.analysis.domain.TextChange;
import com.dartinsight.analysis.domain.TextChangeListing;
import com.dartinsight.textevent.domain.TextEvent;
import com.dartinsight.textevent.domain.TextEventRow;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * 주요 사건 하나.
 *
 * @param fields      묶인 변경이 속한 분야(분야 순서, 겹치지 않음)
 * @param aiGenerated 사건은 모두 AI가 묶은 것이라 코드가 항상 true로 넣는다
 */
public record TextEventItemResponse(long eventId, int sortOrder, String title, String kind, List<String> fields,
        List<Long> changeIds, List<QuoteItem> quotes, Long scaleAmount, String scaleAmountText, String currency,
        Long scaleAmountKrw, BigDecimal scaleRatio, String scaleNotComputedReason, String scaleEvidenceId,
        String amountSource, String fxSource, LocalDate fxRateDate, String sortBasis, boolean aiGenerated,
        String model, String promptVersion, LocalDateTime generatedAt) {

    /** @param changes 변경 번호 → 변경. 사건에 묶인 변경이 모두 있어야 한다 */
    public static TextEventItemResponse of(TextEvent event, Map<Integer, TextChange> changes) {
        TextEventRow row = event.row();
        return new TextEventItemResponse(event.id(), row.sortOrder(), row.title(), row.kind(),
                fields(row, changes), row.changeNos().stream().map(no -> changes.get(no).id()).toList(),
                row.quotes().stream().map(quote -> QuoteItem.of(quote, changes.get(quote.changeNo()))).toList(),
                row.scaleAmount(), row.scaleAmountText(), row.currency(), row.scaleAmountKrw(), row.scaleRatio(),
                row.scaleNotComputedReason(), row.scaleEvidenceId(), row.amountSource(), row.fxSource(),
                row.fxRateDate(), row.sortBasis(), true, row.model(), row.promptVersion(), row.generatedAt());
    }

    private static List<String> fields(TextEventRow row, Map<Integer, TextChange> changes) {
        List<String> found = row.changeNos().stream().map(changes::get)
                .map(change -> change.row().listing())
                .filter(Objects::nonNull)
                .map(TextChangeListing::field)
                .filter(Objects::nonNull)
                .toList();
        return TextChangeListing.FIELDS.stream().filter(found::contains).toList();
    }

    public record QuoteItem(long changeId, String purpose, String side, String text, String evidenceId,
            String sectionPath) {

        static QuoteItem of(TextEventRow.Quote quote, TextChange change) {
            return new QuoteItem(change.id(), quote.purpose(), quote.side(), quote.text(), quote.evidenceId(),
                    change.row().sectionPath());
        }
    }
}
