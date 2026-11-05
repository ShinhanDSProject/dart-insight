package com.dartinsight.textevent.service;

import com.dartinsight.analysis.domain.TextChange;
import com.dartinsight.analysis.domain.TextChangeListing;
import com.dartinsight.analysis.domain.TextChangeListing.RowDiff;
import com.dartinsight.analysis.domain.TextChangeRow;
import com.dartinsight.analysis.domain.TextChangeRow.Side;
import com.dartinsight.document.domain.DocumentBlock;
import com.dartinsight.textevent.domain.StructuredAmount;
import com.dartinsight.textevent.dto.TextEventAiRequest;
import com.dartinsight.textevent.dto.TextEventAiRequest.ChangeItem;
import com.dartinsight.textevent.dto.TextEventAiRequest.StructuredAmountItem;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** 주요 사건 요청 만들기. 후보를 고르는 규칙은 ai-server에 있고, 여기서는 후보가 될 수 있는 묶음만 보낸다(ADR-0051). */
final class TextEventRequests {

    /** ai-server가 후보를 고르는 묶음 */
    private static final Set<String> SENT_GROUPS = Set.of(TextChangeListing.MAIN, "UNPAIRED", "HEADING");
    private static final String COMPARED = "COMPARED";
    /** 표 앞 블록은 단위를 읽는 데만 쓰므로 표에 가까운 끝부분만 보낸다 */
    private static final int PRECEDING_TEXT_LIMIT = 500;

    private TextEventRequests() {
    }

    /** 보낼 변경. 분류된 변경 중 후보가 될 수 있는 묶음 */
    static List<TextChange> candidates(List<TextChange> changes) {
        return changes.stream().filter(change -> {
            TextChangeListing listing = change.row().listing();
            return listing != null && SENT_GROUPS.contains(listing.group());
        }).toList();
    }

    /** 표 변경이면 그 표가 있는 쪽 위치(이번 글이 있으면 이번 쪽). 표가 아니거나 위치가 없으면 null */
    static Side tableSide(TextChange change) {
        TextChangeRow row = change.row();
        if (!DocumentBlock.TABLE.equals(row.blockType())) {
            return null;
        }
        Side side = row.current() != null && row.current().blockNo() != null ? row.current() : row.previous();
        return side == null || side.blockNo() == null ? null : side;
    }

    /** @param blocks 접수번호 → 블록 번호 → 블록. 원문이 없는 보고서는 빠져 있어도 된다 */
    static TextEventAiRequest of(String previousRceptNo, String currentRceptNo, Long equityTotal, String currency,
            String reportBaseDate, List<StructuredAmount> amounts, List<TextChange> candidates,
            Map<String, Map<Integer, DocumentBlock>> blocks) {
        return new TextEventAiRequest(previousRceptNo, currentRceptNo, equityTotal, currency, reportBaseDate,
                amounts.stream().map(amount -> new StructuredAmountItem(amount.rceptNo(), amount.kind().name(),
                        amount.field(), amount.amount(), amount.currency())).toList(),
                candidates.stream().map(change -> item(change, blocks)).toList());
    }

    private static ChangeItem item(TextChange change, Map<String, Map<Integer, DocumentBlock>> blocks) {
        TextChangeRow row = change.row();
        TextChangeListing listing = row.listing();
        Side previous = row.previous();
        Side current = row.current();
        return new ChangeItem(change.changeNo(), row.changeType(), row.blockType(), listing.group(), listing.field(),
                listing.raisedFromNote(), row.sectionPath() == null ? "" : row.sectionPath(),
                previous == null ? null : previous.blockNo(), current == null ? null : current.blockNo(),
                previous == null ? null : previous.text(), current == null ? null : current.text(),
                precedingText(change, blocks), changedUnitCount(listing.rowDiff()));
    }

    /** 표는 바뀐 행 수, 행을 비교하지 못한 표와 표 아닌 변경은 1 */
    private static int changedUnitCount(RowDiff rowDiff) {
        return rowDiff != null && COMPARED.equals(rowDiff.status()) && rowDiff.counts() != null
                ? rowDiff.counts().changed() : 1;
    }

    private static String precedingText(TextChange change, Map<String, Map<Integer, DocumentBlock>> blocks) {
        Side side = tableSide(change);
        if (side == null) {
            return null;
        }
        DocumentBlock block = blocks.getOrDefault(side.rceptNo(), Map.of()).get(side.blockNo() - 1);
        if (block == null || block.text() == null) {
            return null;
        }
        String text = block.text();
        return text.length() <= PRECEDING_TEXT_LIMIT ? text : text.substring(text.length() - PRECEDING_TEXT_LIMIT);
    }
}
