package com.dartinsight.season.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.dartinsight.analysis.domain.TextChangeRow;
import com.dartinsight.analysis.domain.TextChangeRow.Priority;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class SeasonScoreTest {

    private static TextChangeRow row(String type, String path, Integer score) {
        return new TextChangeRow(type, "PARAGRAPH", false, "MATCHED", "제목", path, null, null, null, null,
                score == null ? null : new Priority("MEDIUM", score, List.of(), "priority-2"), null);
    }

    @Test
    @DisplayName("추가·삭제·수정의 우선순위 점수만 더하고 원문 1,000블록당으로 맞춘다")
    void sumsCountedChangesPerThousandBlocks() {
        List<TextChangeRow> rows = List.of(
                row(TextChangeRow.MODIFIED, "II. 사업의 내용 > 1. 사업의 개요", 50),
                row(TextChangeRow.ADDED, "II. 사업의 내용 > 2. 주요 제품", 40),
                row(TextChangeRow.NUMERIC_UPDATE, "III. 재무에 관한 사항", 30),
                row(TextChangeRow.MOVED, "II. 사업의 내용", 30),
                row(TextChangeRow.REVIEW_NEEDED, "II. 사업의 내용", null));

        SeasonScore score = SeasonScore.of(rows, 900, 1100);

        // (50 + 40) ÷ (평균 1,000블록 ÷ 1,000) = 90
        assertThat(score.score()).isEqualByComparingTo(new BigDecimal("90.00"));
        assertThat(score.changeCount()).isEqualTo(2);
    }

    @Test
    @DisplayName("한 줄 요약은 최상위 섹션·변경 종류별 점수 합이 큰 두 묶음을 번호 없이 잇는다")
    void highlightsTopTwoGroups() {
        List<TextChangeRow> rows = List.of(
                row(TextChangeRow.MODIFIED, "II. 사업의 내용 > 1. 사업의 개요", 50),
                row(TextChangeRow.MODIFIED, "II. 사업의 내용 > 2. 주요 제품", 50),
                row(TextChangeRow.ADDED, "XI. 그 밖에 투자자 보호를 위하여 필요한 사항 > 3. 제재", 45),
                row(TextChangeRow.DELETED, "I. 회사의 개요", 20));

        assertThat(SeasonScore.of(rows, 500, 500).highlight())
                .isEqualTo("사업의 내용 수정 2곳 · 그 밖에 투자자 보호를 위하여 필요한 사항 문단 1개 추가");
    }

    @Test
    @DisplayName("넣을 변경이 없으면 점수 0, 요약 없음이고 블록 수가 없으면 계산하지 않는다")
    void emptyAndInvalid() {
        SeasonScore none = SeasonScore.of(List.of(row(TextChangeRow.MOVED, "II. 사업의 내용", 30)), 10, 10);
        assertThat(none.score()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(none.changeCount()).isZero();
        assertThat(none.highlight()).isNull();
        assertThatThrownBy(() -> SeasonScore.of(List.of(), 0, 0)).isInstanceOf(IllegalArgumentException.class);
    }
}
