package com.dartinsight.relateddisclosure.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

import com.dartinsight.analysis.domain.TextChange;
import com.dartinsight.analysis.domain.TextChangeRow;
import com.dartinsight.analysis.domain.TextChangeRow.Side;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class RelatedDisclosureMatcherTest {

    private static final String CUR = "20260814000001";
    private static final String PREV = "20250814000001";
    private static final LocalDate PERIOD_END = LocalDate.of(2026, 6, 30);
    private static final String PLAIN = "III. 재무에 관한 사항 > 1. 요약재무정보";
    private static final String LAWSUIT = "XI. 그 밖에 > 2. 우발부채 등";
    private static final String LAWSUIT_TITLE = "주요사항보고서(소송등의제기)";

    private static long nextId = 1;

    private static WindowDisclosure disclosure(String rceptNo, String reportName, LocalDate rceptDt, String remark) {
        return new WindowDisclosure(nextId++, rceptNo, DisclosureDetailType.B001, reportName, "예시전자", rceptDt,
                remark);
    }

    private static WindowDisclosure lawsuit(String rceptNo, LocalDate rceptDt) {
        return disclosure(rceptNo, LAWSUIT_TITLE, rceptDt, null);
    }

    private static TextChange change(int changeNo, String type, String path, String previousText,
            String currentText, String previousPath) {
        Side previous = previousText == null ? null : new Side(PREV, 3, 1, previousText);
        Side current = currentText == null ? null : new Side(CUR, 3, 1, currentText);
        return new TextChange(changeNo, changeNo, new TextChangeRow(type, "PARAGRAPH", false, "MATCHED", "제목", path,
                previous, current, BigDecimal.ONE, null, null, previousPath));
    }

    private static List<Integer> linkedChanges(List<TextChange> changes, WindowDisclosure... disclosures) {
        return RelatedDisclosureMatcher.match(changes, List.of(disclosures), PERIOD_END).stream()
                .map(RelatedLink::changeNo).toList();
    }

    @Test
    @DisplayName("현재 글이 있는 변경(추가·수정·숫자만 바뀜)은 현재 글로, 삭제는 이전 글로 대조한다")
    void comparesCurrentTextOrPreviousWhenDeleted() {
        List<TextChange> changes = List.of(
                change(1, TextChangeRow.ADDED, PLAIN, null, "소송이 제기되었습니다.", null),
                change(2, TextChangeRow.MODIFIED, PLAIN, "소송이 제기되었습니다.", "과징금을 냈습니다.", null),
                change(3, TextChangeRow.MODIFIED, PLAIN, "과징금을 냈습니다.", "소송이 제기되었습니다.", null),
                change(4, TextChangeRow.NUMERIC_UPDATE, PLAIN, "소송 2건", "소송 3건", null),
                change(5, TextChangeRow.DELETED, PLAIN, "소송이 끝났습니다.", null, null),
                change(6, TextChangeRow.DELETED, PLAIN, "과징금을 냈습니다.", null, null));

        assertThat(linkedChanges(changes, lawsuit("20260108000598", LocalDate.of(2026, 1, 8))))
                .containsExactly(1, 3, 4, 5);
    }

    @Test
    @DisplayName("위치 이동은 현재 글을 보고, 섹션 경로는 이전 쪽 경로도 본다")
    void movedChecksBothSectionPaths() {
        List<TextChange> changes = List.of(
                change(1, TextChangeRow.MOVED, PLAIN, "해당 사항 없음", "해당 사항 없음", LAWSUIT),
                change(2, TextChangeRow.MOVED, LAWSUIT, "해당 사항 없음", "해당 사항 없음", PLAIN),
                change(3, TextChangeRow.MOVED, PLAIN, "해당 사항 없음", "해당 사항 없음", PLAIN),
                // 이동이 아니면 이전 섹션 경로는 보지 않는다
                change(4, TextChangeRow.MODIFIED, PLAIN, "해당 사항 없음", "해당 사항 없음", LAWSUIT));

        assertThat(linkedChanges(changes, lawsuit("20260108000598", LocalDate.of(2026, 1, 8))))
                .containsExactly(1, 2);
    }

    @Test
    @DisplayName("검토 필요 항목도 빼지 않고 있는 쪽 글과 섹션 경로로 대조한다")
    void reviewNeededUsesAvailableSide() {
        TextChange withText = new TextChange(1, 1, new TextChangeRow(TextChangeRow.REVIEW_NEEDED, "PARAGRAPH",
                false, "AMBIGUOUS", "제목", PLAIN, new Side(PREV, 3, 1, "소송이 끝났습니다."), null, null,
                "짝을 정하지 못했어요."));
        TextChange sectionOnly = new TextChange(2, 2, new TextChangeRow(TextChangeRow.REVIEW_NEEDED,
                TextChangeRow.SECTION, false, "AMBIGUOUS", "2. 우발부채 등", LAWSUIT, new Side(PREV, 4, null, null),
                new Side(CUR, 4, null, null), null, "섹션 짝을 정하지 못했어요."));
        TextChange unrelated = new TextChange(3, 3, new TextChangeRow(TextChangeRow.REVIEW_NEEDED,
                TextChangeRow.SECTION, false, "AMBIGUOUS", "1. 요약재무정보", PLAIN, null,
                new Side(CUR, 4, null, null), null, "섹션 짝을 정하지 못했어요."));

        assertThat(linkedChanges(List.of(withText, sectionOnly, unrelated),
                lawsuit("20260108000598", LocalDate.of(2026, 1, 8)))).containsExactly(1, 2);
    }

    @Test
    @DisplayName("원본과 정정본이 둘 다 기간 안이면 정정본만, 정정본이 기간 뒤면 원본을 연결한다")
    void correctedOriginalIsHiddenOnlyWhenCorrectionIsInWindow() {
        TextChange change = change(1, TextChangeRow.ADDED, "I. 회사의 개요 > 3. 자본금 변동사항", null, "유상증자를 했습니다.",
                null);
        WindowDisclosure original = disclosure("20260219002746", "주요사항보고서(유상증자결정)", LocalDate.of(2026, 2, 19),
                "정");
        WindowDisclosure correction = disclosure("20260301000010", "[기재정정]주요사항보고서(유상증자결정)",
                LocalDate.of(2026, 3, 1), null);
        // 기간 뒤에 정정돼 정정본이 목록에 없는 원본(에코프로비엠 20260630000676)
        WindowDisclosure correctedLater = disclosure("20260630000676", "주요사항보고서(유상증자결정)",
                LocalDate.of(2026, 6, 30), "정");

        List<RelatedLink> links = RelatedDisclosureMatcher.match(List.of(change),
                List.of(original, correction, correctedLater), PERIOD_END);

        assertThat(links).extracting(l -> l.disclosure().rceptNo())
                .containsExactly("20260301000010", "20260630000676");
        assertThat(links).allSatisfy(l -> assertThat(l.latestRceptNo()).isNull());
    }

    @Test
    @DisplayName("비고에 '철'이 있으면 연결하지 않는다")
    void withdrawnIsNotLinked() {
        TextChange change = change(1, TextChangeRow.ADDED, LAWSUIT, null, "소송이 제기되었습니다.", null);

        assertThat(linkedChanges(List.of(change),
                disclosure("20260108000598", LAWSUIT_TITLE, LocalDate.of(2026, 1, 8), "유철"))).isEmpty();
    }

    @Test
    @DisplayName("정정본 하나는 같은 제목의 원본 하나만 숨긴다: 다른 계약은 남고, 여러 번 고친 사건은 마지막 정정본만 남는다")
    void eachCorrectionReplacesOneOriginal() {
        TextChange change = change(1, TextChangeRow.ADDED, "II. 사업의 내용 > 6. 주요계약", null, "공급 계약을 맺었습니다.",
                null);
        String title = "단일판매ㆍ공급계약체결";
        // 계약 A: 정정본이 기간 뒤라 원본만 있다. 계약 B: 원본 → 정정 1 → 정정 2
        WindowDisclosure contractA = disclosure("20260312800389", title, LocalDate.of(2026, 3, 12), "유정");
        WindowDisclosure contractB = disclosure("20260320800516", title, LocalDate.of(2026, 3, 20), "유정");
        WindowDisclosure firstFix = disclosure("20260325801220", "[기재정정]" + title, LocalDate.of(2026, 3, 25),
                "유정");
        WindowDisclosure secondFix = disclosure("20260401800001", "[기재정정]" + title, LocalDate.of(2026, 4, 1),
                "유");

        List<RelatedLink> links = RelatedDisclosureMatcher.match(List.of(change),
                List.of(contractA, contractB, firstFix, secondFix), PERIOD_END);

        assertThat(links).extracting(l -> l.disclosure().rceptNo())
                .containsExactly("20260312800389", "20260401800001");
    }

    @Test
    @DisplayName("접수일이 현재 보고서 기간 말일 이하면 DURING, 뒤면 AFTER다")
    void timingByPeriodEnd() {
        TextChange change = change(1, TextChangeRow.ADDED, LAWSUIT, null, "소송이 제기되었습니다.", null);

        List<RelatedLink> links = RelatedDisclosureMatcher.match(List.of(change), List.of(
                lawsuit("20260701000001", LocalDate.of(2026, 7, 1)),
                lawsuit("20260630000001", LocalDate.of(2026, 6, 30))), PERIOD_END);

        assertThat(links).extracting(l -> l.disclosure().rceptNo(), RelatedLink::timing).containsExactly(
                tuple("20260630000001", DisclosureTiming.DURING),
                tuple("20260701000001", DisclosureTiming.AFTER));
        assertThat(links).allSatisfy(l -> {
            assertThat(l.matchRule()).isEqualTo("litigation");
            assertThat(l.matchLevel()).isEqualTo(MatchLevel.TYPE_ONLY);
            assertThat(l.matchedFields()).isNull();
        });
    }

    @Test
    @DisplayName("같은 입력이면 공시 순서가 달라도 결과가 같다")
    void sameInputGivesSameResult() {
        List<TextChange> changes = List.of(
                change(1, TextChangeRow.ADDED, LAWSUIT, null, "소송이 제기되었습니다.", null),
                change(2, TextChangeRow.ADDED, "II. 사업의 내용 > 6. 주요계약", null, "공급 계약을 맺었습니다.", null));
        WindowDisclosure a = lawsuit("20260108000598", LocalDate.of(2026, 1, 8));
        WindowDisclosure b = disclosure("20250731800028", "단일판매ㆍ공급계약체결", LocalDate.of(2025, 7, 31), "코");
        WindowDisclosure c = disclosure("20260205000191", "기업설명회(IR)개최", LocalDate.of(2026, 2, 5), null);

        List<RelatedLink> first = RelatedDisclosureMatcher.match(changes, List.of(a, b, c), PERIOD_END);
        List<RelatedLink> second = RelatedDisclosureMatcher.match(changes, List.of(c, b, a), PERIOD_END);

        assertThat(second).isEqualTo(first);
        assertThat(first).extracting(RelatedLink::changeNo, l -> l.disclosure().rceptNo(), RelatedLink::matchRule)
                .containsExactly(
                        tuple(1, "20260108000598", "litigation"),
                        tuple(2, "20250731800028", "supply-contract"));
    }

    @Test
    @DisplayName("공시나 걸리는 규칙이 없으면 연결이 0건이다")
    void noLinksWhenNothingMatches() {
        TextChange change = change(1, TextChangeRow.ADDED, PLAIN, null, "매출이 늘었습니다.", null);

        assertThat(linkedChanges(List.of(change))).isEmpty();
        assertThat(linkedChanges(List.of(change), lawsuit("20260108000598", LocalDate.of(2026, 1, 8)))).isEmpty();
    }
}
