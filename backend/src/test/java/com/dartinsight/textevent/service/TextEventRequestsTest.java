package com.dartinsight.textevent.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.dartinsight.analysis.domain.TextChange;
import com.dartinsight.analysis.domain.TextChangeListing;
import com.dartinsight.analysis.domain.TextChangeListing.RowDiff;
import com.dartinsight.analysis.domain.TextChangeRow;
import com.dartinsight.analysis.domain.TextChangeRow.Side;
import com.dartinsight.document.domain.DocumentBlock;
import com.dartinsight.textevent.dto.TextEventAiRequest;
import com.dartinsight.textevent.dto.TextEventAiRequest.ChangeItem;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class TextEventRequestsTest {

    private static final String PREV = "20250814000001";
    private static final String CUR = "20260814000001";

    private static TextChange change(int no, String blockType, String group, RowDiff rowDiff, Side previous,
            Side current) {
        TextChangeListing listing = group == null ? null
                : new TextChangeListing(group, "OTHER", false, null, rowDiff, "list-1");
        return new TextChange(no, no, new TextChangeRow(TextChangeRow.MODIFIED, blockType, false, "MATCHED", "제목",
                null, previous, current, null, null, null, null, listing));
    }

    private static Side side(String rceptNo, int blockNo) {
        return new Side(rceptNo, 1, blockNo, "글");
    }

    private static RowDiff compared(int changed) {
        return new RowDiff("COMPARED", "구분", new RowDiff.Counts(changed, 1, 1, 2), null, List.of(), List.of(),
                List.of());
    }

    private static ChangeItem item(TextChange change, Map<String, Map<Integer, DocumentBlock>> blocks) {
        TextEventAiRequest request = TextEventRequests.of(PREV, CUR, null, null, "2026-06-30", List.of(),
                List.of(change), blocks);
        return request.changes().getFirst();
    }

    private static Map<String, Map<Integer, DocumentBlock>> blockBefore(String rceptNo, int blockNo, String text) {
        return Map.of(rceptNo, Map.of(blockNo - 1,
                new DocumentBlock(rceptNo, blockNo - 1, 1, DocumentBlock.PARAGRAPH, text, null)));
    }

    @Test
    @DisplayName("MAIN·UNPAIRED·HEADING만 보내고 분류 전 변경과 다른 묶음은 보내지 않는다")
    void onlyCandidateGroupsAreSent() {
        List<TextChange> changes = List.of(
                change(1, "PARAGRAPH", "MAIN", null, null, side(CUR, 1)),
                change(2, "PARAGRAPH", "UNPAIRED", null, null, side(CUR, 2)),
                change(3, "PARAGRAPH", "HEADING", null, null, side(CUR, 3)),
                change(4, "PARAGRAPH", "FORMATTING", null, null, side(CUR, 4)),
                change(5, "PARAGRAPH", TextChangeListing.NOTE, null, null, side(CUR, 5)),
                change(6, "PARAGRAPH", null, null, null, side(CUR, 6)));

        assertThat(TextEventRequests.candidates(changes)).extracting(TextChange::changeNo).containsExactly(1, 2, 3);
    }

    @Test
    @DisplayName("바뀐 단위 수는 비교한 표면 바뀐 행 수, 비교하지 못한 표와 문단은 1이다")
    void changedUnitCountFollowsRowDiff() {
        RowDiff notCompared = new RowDiff("NOT_COMPARED", null, null, null, List.of(), List.of(), List.of());

        assertThat(item(change(1, "TABLE", "MAIN", compared(3), null, side(CUR, 1)), Map.of()).changedUnitCount())
                .isEqualTo(3);
        assertThat(item(change(1, "TABLE", "MAIN", compared(0), null, side(CUR, 1)), Map.of()).changedUnitCount())
                .isZero();
        assertThat(item(change(1, "TABLE", "MAIN", notCompared, null, side(CUR, 1)), Map.of()).changedUnitCount())
                .isEqualTo(1);
        assertThat(item(change(1, "PARAGRAPH", "MAIN", null, null, side(CUR, 1)), Map.of()).changedUnitCount())
                .isEqualTo(1);
    }

    @Test
    @DisplayName("표는 이번 쪽 바로 앞 블록을 보내고, 이번 글이 없으면 이전 쪽 앞 블록을 보낸다")
    void precedingBlockFollowsTableSide() {
        TextChange both = change(1, "TABLE", "MAIN", null, side(PREV, 50), side(CUR, 10));
        TextChange deleted = change(2, "TABLE", "MAIN", null, side(PREV, 50), null);

        assertThat(item(both, blockBefore(CUR, 10, "(단위 : 백만원)")).precedingBlockText()).isEqualTo("(단위 : 백만원)");
        assertThat(item(deleted, blockBefore(PREV, 50, "(단위 : 천원)")).precedingBlockText()).isEqualTo("(단위 : 천원)");
    }

    @Test
    @DisplayName("표가 아니거나 앞 블록이 없으면 앞 블록 글을 보내지 않는다")
    void noPrecedingBlockWithoutTable() {
        TextChange paragraph = change(1, "PARAGRAPH", "MAIN", null, null, side(CUR, 10));
        TextChange table = change(2, "TABLE", "MAIN", null, null, side(CUR, 10));

        assertThat(item(paragraph, blockBefore(CUR, 10, "글")).precedingBlockText()).isNull();
        assertThat(item(table, Map.of()).precedingBlockText()).isNull();
    }

    @Test
    @DisplayName("앞 블록이 길면 표에 가까운 끝부분 500자만 보낸다")
    void longPrecedingBlockKeepsTail() {
        String text = "가".repeat(600) + "(단위 : 백만원)";
        TextChange table = change(1, "TABLE", "MAIN", null, null, side(CUR, 10));

        String sent = item(table, blockBefore(CUR, 10, text)).precedingBlockText();

        assertThat(sent).hasSize(500).endsWith("(단위 : 백만원)");
    }

    @Test
    @DisplayName("섹션 경로가 없으면 빈 글로 보낸다(ai-server는 null을 받지 않는다)")
    void missingSectionPathIsEmpty() {
        assertThat(item(change(1, "PARAGRAPH", "MAIN", null, null, side(CUR, 1)), Map.of()).sectionPath()).isEmpty();
    }
}
