package com.dartinsight.summary;

import static org.assertj.core.api.Assertions.assertThat;

import com.dartinsight.analysis.CalcStatus;
import com.dartinsight.analysis.FinancialChangeRow;
import com.dartinsight.analysis.TextChangeRow;
import com.dartinsight.analysis.TextChangeRow.Priority;
import com.dartinsight.analysis.TextChangeRow.Side;
import com.dartinsight.comparison.AmountBasis;
import com.dartinsight.document.DocumentBlock;
import com.dartinsight.document.DocumentSection;
import com.dartinsight.financial.FsDiv;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class SummarySelectorTest {

    private static FinancialChangeRow fin(String sjDiv, String name, Long previous, Long current, CalcStatus status) {
        Long change = previous == null || current == null ? null : current - previous;
        return new FinancialChangeRow(sjDiv, FsDiv.CFS, name, name, 0, AmountBasis.POINT, previous, current, change,
                null, status, "KRW", null, null);
    }

    private static TextChangeRow text(String level, Integer score, boolean numbersOnly) {
        return new TextChangeRow(TextChangeRow.ADDED, "PARAGRAPH", numbersOnly, "MATCHED", "t", "p", null,
                new Side("20260814000001", 1, 1, "글"), null, null,
                level == null ? null : new Priority(level, score, List.of(), "priority-1"));
    }

    @Test
    void picksLargestIncomeAndBalanceChangesThatWereCalculated() {
        List<FinancialChangeRow> rows = List.of(
                fin("IS", "매출액", 100L, 200L, CalcStatus.OK),
                fin("IS", "영업이익", 10L, 5L, CalcStatus.OK),
                fin("IS", "순이익", 1L, 1L, CalcStatus.OK),
                fin("IS", "기타", 0L, 999L, CalcStatus.PREVIOUS_ZERO),
                fin("IS", "법인세", 50L, 52L, CalcStatus.OK),
                fin("IS", "금융비용", 3L, 4L, CalcStatus.OK),
                fin("BS", "자산총계", 1000L, 1100L, CalcStatus.OK),
                fin("BS", "부채총계", 500L, 520L, CalcStatus.OK),
                fin("BS", "자본총계", 500L, 501L, CalcStatus.OK),
                fin("CF", "현금", 1L, 999L, CalcStatus.OK));

        assertThat(SummarySelector.financial(rows)).containsExactly(0, 1, 4, 6, 7);
    }

    @Test
    void singleIncomeStatementFilersUseComprehensiveIncome() {
        List<FinancialChangeRow> rows = List.of(
                fin("CIS", "매출액", 100L, 200L, CalcStatus.OK),
                fin("CIS", "영업이익", 10L, 5L, CalcStatus.OK),
                fin("BS", "자산총계", 1000L, 1100L, CalcStatus.OK));

        assertThat(SummarySelector.financial(rows)).containsExactly(0, 1, 2);
    }

    @Test
    void picksHighAndMediumTextChangesByScore() {
        List<TextChangeRow> rows = List.of(text("LOW", 10, false), text("MEDIUM", 40, false),
                text("HIGH", 70, true), text("HIGH", 65, false), text("UNRANKED", null, false), text(null, null, false));

        assertThat(SummarySelector.text(rows)).containsExactly(3, 1);
    }

    @Test
    void explanationCandidatesComeFromExplainingSectionsAndMentionTheAccount() {
        List<DocumentSection> sections = List.of(
                new DocumentSection(1, null, 1, "II. 사업의 내용", null, false, 0),
                new DocumentSection(2, null, 1, "IV. 이사의 경영진단 및 분석의견", null, false, 3),
                new DocumentSection(3, null, 1, "VII. 주주에 관한 사항", null, false, 1));
        String rcept = "20260814000001";
        List<DocumentBlock> blocks = List.of(
                new DocumentBlock(rcept, 1, 2, "PARAGRAPH", "매출 액은 수요 회복으로 늘었습니다.", null),
                new DocumentBlock(rcept, 2, 2, "TABLE", "매출액 | 100", "[]"),
                new DocumentBlock(rcept, 3, 3, "PARAGRAPH", "매출액 관련 주주 안내", null),
                new DocumentBlock(rcept, 4, 2, "PARAGRAPH", "영업이익은 줄었습니다.", null),
                new DocumentBlock(rcept, 5, 2, "PARAGRAPH", "매출액이 늘어난 다른 이유", null),
                new DocumentBlock(rcept, 6, 2, "PARAGRAPH", "매출액 세 번째 문단", null));

        List<SummaryAiRequest.Source> found = SummarySelector.candidates(List.of("매출액"), sections, blocks);

        assertThat(found).extracting(SummaryAiRequest.Source::evidenceId)
                .containsExactly(rcept + "#B1", rcept + "#B5");
        assertThat(found.getFirst().sectionPath()).isEqualTo("IV. 이사의 경영진단 및 분석의견");
    }

    @Test
    @DisplayName("검색어 중 하나라도 나오는 문단을 문서 순서대로 고르고, 검색어가 없으면 고르지 않는다")
    void explanationCandidatesMatchAnyOfTheTerms() {
        List<DocumentSection> sections = List.of(new DocumentSection(1, null, 1, "IV. 이사의 경영진단 및 분석의견", null,
                false, 0));
        String rcept = "20250312000906";
        List<DocumentBlock> blocks = List.of(
                new DocumentBlock(rcept, 1, 1, "PARAGRAPH", "매출채권 회전율은 개선되었습니다.", null),
                new DocumentBlock(rcept, 2, 1, "PARAGRAPH", "원가절감 활동으로 영업적자폭을 축소하였습니다.", null),
                new DocumentBlock(rcept, 3, 1, "PARAGRAPH", "연간 5,606억원의 영업손실을 기록하였습니다.", null));
        List<String> terms = AccountAliases.of("dart_OperatingIncomeLoss", "영업손실");

        assertThat(SummarySelector.candidates(terms, sections, blocks))
                .extracting(SummaryAiRequest.Source::evidenceId)
                .containsExactly(rcept + "#B2", rcept + "#B3");
        assertThat(SummarySelector.candidates(List.of(), sections, blocks)).isEmpty();
    }
}
