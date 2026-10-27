package com.dartinsight.note.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class JudgmentNoteItemTest {

    private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 27, 9, 0);
    private static final NoteSnapshot SNAPSHOT = new NoteSnapshot("00126380", NoteKind.FINANCIAL_CHANGE, 1L, "v1", 2L,
            "IS", "20260814000001", null, null, null, "손익계산서 · 매출액", "이전 1원 → 현재 2원");

    @Test
    @DisplayName("메모는 앞뒤 공백을 지우고, 비었으면 null로 둔다")
    void memoIsStrippedAndBlankIsNull() {
        JudgmentNoteItem item = JudgmentNoteItem.create(1L, SNAPSHOT, "  확인할 것 \n", NOW);
        assertThat(item.getMemo()).isEqualTo("확인할 것");

        item.changeMemo("   ", NOW.plusMinutes(1));
        assertThat(item.getMemo()).isNull();

        assertThat(JudgmentNoteItem.create(1L, SNAPSHOT, null, NOW).getMemo()).isNull();
    }
}
