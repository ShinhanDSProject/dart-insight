package com.dartinsight.analysis.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.domain.TextChangeRow.Side;
import com.dartinsight.analysis.domain.TextChangeRow;
import com.dartinsight.comparison.domain.ComparisonBasis;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;

/** 문장 비교 결과의 근거 확인(AnalysisRunner.verifyText) */
class TextVerifyTest {

    private static final String CUR = "20260814000001";
    private static final String PREV = "20250814000001";
    private static final Analysis ANALYSIS = Analysis.request("00000001", CUR, PREV, ComparisonBasis.YOY, null,
            LocalDateTime.of(2026, 10, 21, 9, 0));

    private static TextChangeRow row(String type, Side previous, Side current) {
        return new TextChangeRow(type, "PARAGRAPH", false, "MATCHED", "t", "p", previous, current, null, null);
    }

    @Test
    void wellFormedChangesPass() {
        assertThat(AnalysisRunner.verifyText(ANALYSIS, List.of(
                row(TextChangeRow.ADDED, null, new Side(CUR, 1, 2, "새 글")),
                row(TextChangeRow.DELETED, new Side(PREV, 1, 2, "옛 글"), null),
                row(TextChangeRow.MODIFIED, new Side(PREV, 1, 3, "a"), new Side(CUR, 1, 3, "b")),
                new TextChangeRow(TextChangeRow.REVIEW_NEEDED, TextChangeRow.SECTION, false, "AMBIGUOUS", "t", "p",
                        new Side(PREV, 4, null, null), null, null, "사유")))).isNull();
    }

    @Test
    void blockTypeAndSectionNamesMustBeKnown() {
        assertThat(AnalysisRunner.verifyText(ANALYSIS, List.of(new TextChangeRow(TextChangeRow.ADDED, "IMAGE", false,
                "MATCHED", "t", "p", null, new Side(CUR, 1, 2, "글"), null, null)))).contains("종류나 항목 이름");
        assertThat(AnalysisRunner.verifyText(ANALYSIS, List.of(new TextChangeRow(TextChangeRow.ADDED, "PARAGRAPH",
                false, "MATCHED", "t", null, null, new Side(CUR, 1, 2, "글"), null, null)))).contains("종류나 항목 이름");
    }

    @Test
    void typeMustMatchTheSidesItHas() {
        assertThat(AnalysisRunner.verifyText(ANALYSIS, List.of(
                row(TextChangeRow.ADDED, new Side(PREV, 1, 2, "a"), new Side(CUR, 1, 2, "b")))))
                .contains("변경 유형");
        assertThat(AnalysisRunner.verifyText(ANALYSIS, List.of(
                new TextChangeRow(TextChangeRow.REVIEW_NEEDED, TextChangeRow.SECTION, false, "AMBIGUOUS", "t", "p",
                        null, new Side(CUR, 4, null, null), null, null)))).contains("변경 유형");
    }

    @Test
    void sidesMustBeTheReportsOfThisAnalysis() {
        assertThat(AnalysisRunner.verifyText(ANALYSIS, List.of(
                row(TextChangeRow.ADDED, null, new Side(PREV, 1, 2, "다른 보고서")))))
                .contains("이 분석의 보고서");
    }

    @Test
    void blockChangesMustPointToStoredText() {
        assertThat(AnalysisRunner.verifyText(ANALYSIS, List.of(
                row(TextChangeRow.ADDED, null, new Side(CUR, 1, 99, null)))))
                .contains("원문을 찾지 못했어요");
    }
}
