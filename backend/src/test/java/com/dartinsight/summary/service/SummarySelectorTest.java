package com.dartinsight.summary.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.dartinsight.analysis.domain.CalcStatus;
import com.dartinsight.analysis.domain.FinancialChangeRow;
import com.dartinsight.analysis.domain.TextChangeRow;
import com.dartinsight.analysis.domain.TextChangeRow.Priority;
import com.dartinsight.analysis.domain.TextChangeRow.Side;
import com.dartinsight.comparison.domain.AmountBasis;
import com.dartinsight.document.domain.DocumentBlock;
import com.dartinsight.document.domain.DocumentSection;
import com.dartinsight.financial.domain.FsDiv;
import com.dartinsight.summary.dto.SummaryAiRequest;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class SummarySelectorTest {

    private static FinancialChangeRow fin(String sjDiv, String name, Long previous, Long current, CalcStatus status) {
        Long change = previous == null || current == null ? null : current - previous;
        return new FinancialChangeRow(sjDiv, FsDiv.CFS, name, name, 0, AmountBasis.POINT, previous, current, change,
                null, status, "KRW", null, null);
    }

    private static TextChangeRow text(String level, Integer score, String type) {
        Side side = new Side("20260814000001", 1, 1, "글");
        return new TextChangeRow(type, "PARAGRAPH", TextChangeRow.NUMERIC_UPDATE.equals(type), "MATCHED", "t", "p",
                TextChangeRow.ADDED.equals(type) ? null : side, side, null, null,
                level == null ? null : new Priority(level, score, List.of(), "priority-2"),
                TextChangeRow.MOVED.equals(type) ? "q" : null);
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
    @DisplayName("이익 계정의 흑자·적자 상태는 요약하고, 부호만 바뀐 그 밖의 계정은 뺀다")
    void profitStatesAreSummarizedButOtherSignChangesAreNot() {
        List<FinancialChangeRow> rows = List.of(
                fin("IS", "영업이익", -7_730L, 23_467L, CalcStatus.TURNED_PROFIT),
                fin("IS", "법인세비용", -4_480L, 3_078L, CalcStatus.SIGN_CHANGED),
                fin("IS", "당기순손실", -2_576L, -2_409L, CalcStatus.LOSS_NARROWED),
                fin("IS", "기타손익", -100L, -50L, CalcStatus.PREVIOUS_NEGATIVE));

        assertThat(SummarySelector.financial(rows)).containsExactly(0, 2);
    }

    @Test
    @DisplayName("이미 고른 계정과 이전·현재 금액이 모두 같은 계정은 건너뛰고 다음 계정으로 채운다")
    void skipsAccountsWithTheSameAmountsAsAPickedOne() {
        List<FinancialChangeRow> rows = List.of(
                fin("IS", "매출액", 100L, 200L, CalcStatus.OK),
                fin("IS", "매출총이익", 100L, 200L, CalcStatus.OK),
                fin("IS", "영업이익", 10L, 5L, CalcStatus.OK),
                fin("IS", "순이익", 3L, 4L, CalcStatus.OK),
                fin("BS", "자산총계", 5049L, 7595L, CalcStatus.OK),
                fin("BS", "부채와자본총계", 5049L, 7595L, CalcStatus.OK),
                fin("BS", "부채총계", 1000L, 1500L, CalcStatus.OK),
                fin("BS", "자본총계", 4049L, 6095L, CalcStatus.OK),
                fin("CIS", "총포괄이익", 100L, 200L, CalcStatus.OK));

        assertThat(SummarySelector.financial(rows)).containsExactly(0, 2, 3, 4, 7);
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
        String added = TextChangeRow.ADDED;
        List<TextChangeRow> rows = List.of(text("LOW", 10, added), text("MEDIUM", 40, added),
                text("HIGH", 70, TextChangeRow.NUMERIC_UPDATE), text("HIGH", 65, added),
                text("UNRANKED", null, TextChangeRow.REVIEW_NEEDED), text(null, null, added));

        assertThat(SummarySelector.text(rows)).containsExactly(3, 1);
    }

    @Test
    @DisplayName("숫자만 바뀜·위치 이동·검토 필요는 점수가 높아도 요약할 문장 변화로 고르지 않는다")
    void skipsNumericUpdatesMovesAndReviewItems() {
        List<TextChangeRow> rows = List.of(text("HIGH", 90, TextChangeRow.NUMERIC_UPDATE),
                text("HIGH", 80, TextChangeRow.MOVED), text("MEDIUM", 30, TextChangeRow.MODIFIED),
                text("HIGH", 70, TextChangeRow.DELETED));

        assertThat(SummarySelector.text(rows)).containsExactly(3, 2);
    }

    @Test
    @DisplayName("설명 후보를 찾을 원문으로 현재 보고서의 문단을 섹션과 관계없이 문서 순서대로 모두 보내고 표는 보내지 않는다")
    void allParagraphsOfTheCurrentReportAreSentForTheCandidateSearch() {
        List<DocumentSection> sections = List.of(
                new DocumentSection(1, null, 1, "II. 사업의 내용", null, false, 0),
                new DocumentSection(2, null, 1, "IV. 이사의 경영진단 및 분석의견", null, false, 3),
                new DocumentSection(3, 2, 2, "2. 영업실적", null, false, 0),
                new DocumentSection(4, null, 1, "VII. 주주에 관한 사항", null, false, 1));
        String rcept = "20260814000001";
        List<DocumentBlock> blocks = List.of(
                new DocumentBlock(rcept, 1, 3, "PARAGRAPH", "매출액은 수요 회복으로 늘었습니다.", null),
                new DocumentBlock(rcept, 2, 3, "TABLE", "매출액 | 100", "[]"),
                new DocumentBlock(rcept, 3, 4, "PARAGRAPH", "주주총회 안내", null),
                new DocumentBlock(rcept, 4, 1, "PARAGRAPH", "  ", null));

        List<SummaryAiRequest.Source> sent = SummarySelector.paragraphs(sections, blocks);

        assertThat(sent).extracting(SummaryAiRequest.Source::evidenceId)
                .containsExactly(rcept + "#B1", rcept + "#B3");
        assertThat(sent.getFirst().sectionPath()).isEqualTo("IV. 이사의 경영진단 및 분석의견 > 2. 영업실적");
        assertThat(sent.getFirst().text()).isEqualTo("매출액은 수요 회복으로 늘었습니다.");
        assertThat(SummarySelector.paragraphs(List.of(), List.of())).isEmpty();
    }
}
