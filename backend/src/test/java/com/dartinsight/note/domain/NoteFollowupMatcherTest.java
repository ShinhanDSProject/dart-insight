package com.dartinsight.note.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.domain.CompletedAnalysis;
import com.dartinsight.comparison.domain.ComparisonBasis;
import com.dartinsight.disclosure.domain.Disclosure;
import com.dartinsight.note.domain.NoteFollowupMatcher.MatchedDisclosure;
import com.dartinsight.report.domain.Correction;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.domain.ReportNameParser.ParsedReportName;
import com.dartinsight.report.domain.ReportType;
import java.lang.reflect.Field;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class NoteFollowupMatcherTest {
    private static final String CORP = "00126380";
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 27, 9, 0);

    @Test
    @DisplayName("기준 접수번호는 기업의 노트 항목들이 가진 14자리 접수번호 중 가장 이른 값이다")
    void picksEarliestValidBaselineRceptNo() {
        JudgmentNoteItem later = item(NoteKind.FINANCIAL_CHANGE, 1L, "20260814000001", "손익계산서 · 매출액", "1원", null);
        JudgmentNoteItem earlier = item(NoteKind.TEXT_CHANGE, 1L, "20250814000001", "II. 사업의 내용", "문장", null);
        JudgmentNoteItem withoutRceptNo = item(NoteKind.TEXT_CHANGE, 1L, null, "II. 사업의 내용", "문장", null);

        assertThat(NoteFollowupMatcher.baselineRceptNo(List.of(later, earlier, withoutRceptNo)))
                .contains("20250814000001");
        assertThat(NoteFollowupMatcher.baselineRceptNo(List.of(withoutRceptNo))).isEmpty();
        assertThat(NoteFollowupMatcher.baselineRceptNo(List.of())).isEmpty();
    }

    @Test
    @DisplayName("후속 분석은 기준 접수번호보다 뒤의 완료 분석 가운데 이미 노트에 담은 분석 ID를 빼고 최대 3건을 고른다")
    void filtersNewerCompletedAnalysesExcludingNotedOnes() {
        JudgmentNoteItem noted = item(NoteKind.TEXT_CHANGE, 10L, "20250814000001", "II. 사업의 내용", "빠진 문단", null);
        CompletedAnalysis sameAnalysis = completedAnalysis(10L, "20250814000001", "20260515000001",
                "반기보고서 (2025.06)", "분기보고서 (2026.03)");
        CompletedAnalysis older = completedAnalysis(11L, "20240814000001", "20250814000001",
                "반기보고서 (2024.06)", "반기보고서 (2025.06)");
        CompletedAnalysis newer1 = completedAnalysis(12L, "20251114000001", "20261114000001",
                "분기보고서 (2025.09)", "분기보고서 (2026.09)");
        CompletedAnalysis newer2 = completedAnalysis(13L, "20250814000001", "20260814000001",
                "반기보고서 (2025.06)", "반기보고서 (2026.06)");
        CompletedAnalysis newer3 = completedAnalysis(14L, "20250515000001", "20260515000002",
                "분기보고서 (2025.03)", "분기보고서 (2026.03)");
        CompletedAnalysis newer4 = completedAnalysis(15L, "20250315000001", "20260315000001",
                "사업보고서 (2024.12)", "사업보고서 (2025.12)");

        List<CompletedAnalysis> result = NoteFollowupMatcher.newerAnalyses(
                List.of(noted), List.of(sameAnalysis, older, newer1, newer2, newer3, newer4));

        assertThat(result).extracting(c -> c.analysis().getId()).containsExactly(12L, 13L, 14L);
    }

    @Test
    @DisplayName("후속 공시는 기준 접수번호 이후의 철회 아닌 공시를 접수일·접수번호 최근 순으로 최대 5건 고른다")
    void filtersAndSortsNewerDisclosures() {
        JudgmentNoteItem noted = item(NoteKind.FINANCIAL_CHANGE, 1L, "20260814000001", "손익계산서 · 매출액", "1원", null);
        List<Disclosure> disclosures = List.of(
                disclosure("20260814000001", "반기보고서 (2026.06)", LocalDate.of(2026, 8, 14), "유"),
                disclosure("20260901000001", "단일판매ㆍ공급계약체결", LocalDate.of(2026, 9, 1), "유"),
                disclosure("20260905000001", "유상증자결정", LocalDate.of(2026, 9, 5), "철"),
                disclosure("20260910000001", "타법인주식및출자증권취득결정", LocalDate.of(2026, 9, 10), "유"),
                disclosure("20260910000002", "전환사채권발행결정", LocalDate.of(2026, 9, 10), "유"),
                disclosure("20260915000001", "소송등의제기ㆍ신청", LocalDate.of(2026, 9, 15), null),
                disclosure("20260920000001", "영업(잠정)실적(공정공시)", LocalDate.of(2026, 9, 20), "유"),
                disclosure("20260925000001", "기업설명회(IR)개최(안내공시)", LocalDate.of(2026, 9, 25), "유"));

        List<Disclosure> result = NoteFollowupMatcher.newerDisclosures(List.of(noted), disclosures);

        assertThat(result).extracting(Disclosure::rceptNo).containsExactly(
                "20260925000001", "20260920000001", "20260915000001", "20260910000002", "20260910000001");
    }

    @Test
    @DisplayName("재무 수치 항목이 매출액·영업이익·당기순이익이면 이후 실적 공시를 '실적'으로 연결한다")
    void matchesFinancialEarningsDisclosures() {
        JudgmentNoteItem revenue = item(NoteKind.FINANCIAL_CHANGE, 1L, "20260814000001",
                "손익계산서 · 매출액", "이전 100원 → 현재 120원", null);
        List<Disclosure> disclosures = List.of(
                disclosure("20260910000001", "영업(잠정)실적(공정공시)", LocalDate.of(2026, 9, 10), "유"),
                disclosure("20260915000001", "단일판매ㆍ공급계약체결", LocalDate.of(2026, 9, 15), "유"));

        List<MatchedDisclosure> matched = NoteFollowupMatcher.relatedDisclosures(revenue, disclosures);

        assertThat(matched).hasSize(1);
        assertThat(matched.getFirst().disclosure().rceptNo()).isEqualTo("20260910000001");
        assertThat(matched.getFirst().matchLabel()).isEqualTo("실적");
    }

    @Test
    @DisplayName("문장·메모의 주제 규칙과 메모 핵심어로 이후 공시를 최대 3건 연결하고 일반어·철회 공시는 뺀다")
    void matchesByRuleOrMemoKeywordUpToThree() {
        JudgmentNoteItem note = item(NoteKind.TEXT_CHANGE, 1L, "20260814000001",
                "II. 사업의 내용 > 4. 매출 및 수주상황", "신규 공급계약을 체결하였습니다.",
                "자기주식 소각 여부 확인 예정");
        List<Disclosure> disclosures = List.of(
                disclosure("20260810000001", "단일판매ㆍ공급계약체결", LocalDate.of(2026, 8, 10), "유"),
                disclosure("20260901000001", "단일판매ㆍ공급계약체결", LocalDate.of(2026, 9, 1), "유"),
                disclosure("20260905000001", "주식소각결정", LocalDate.of(2026, 9, 5), "유"),
                disclosure("20260908000001", "[기재정정]자기주식취득결정", LocalDate.of(2026, 9, 8), "유"),
                disclosure("20260912000001", "단일판매ㆍ공급계약해지", LocalDate.of(2026, 9, 12), "유"),
                disclosure("20260915000001", "단일판매ㆍ공급계약체결", LocalDate.of(2026, 9, 15), "철"),
                disclosure("20260920000001", "주주총회소집공고 (보고서 확인 예정)", LocalDate.of(2026, 9, 20), "유"));

        List<MatchedDisclosure> matched = NoteFollowupMatcher.relatedDisclosures(note, disclosures);

        assertThat(matched).hasSize(3);
        assertThat(matched).extracting(m -> m.disclosure().rceptNo())
                .containsExactly("20260912000001", "20260908000001", "20260905000001");
        assertThat(matched).extracting(MatchedDisclosure::matchLabel)
                .containsExactly("공급계약", "메모 '자기주식'", "메모 '소각'");
    }

    private static JudgmentNoteItem item(NoteKind kind, Long analysisId, String rceptNo, String label, String text,
            String memo) {
        NoteSnapshot snapshot = new NoteSnapshot(CORP, kind, analysisId, Analysis.CURRENT_VERSION, 1L, "IS",
                rceptNo, 1, 1, null, label, text);
        return JudgmentNoteItem.create(1L, snapshot, memo, NOW);
    }

    private static Disclosure disclosure(String rceptNo, String reportName, LocalDate rceptDt, String remark) {
        return new Disclosure(rceptNo, reportName, "예시전자", rceptDt, remark);
    }

    private static CompletedAnalysis completedAnalysis(long id, String prevRceptNo, String curRceptNo,
            String prevName, String curName) {
        Analysis analysis = Analysis.request(CORP, curRceptNo, prevRceptNo, ComparisonBasis.YOY, null, NOW);
        analysis.start(NOW);
        analysis.complete(NOW);
        setId(analysis, id);
        Report prev = Report.create(prevRceptNo, CORP, prevName,
                new ParsedReportName(ReportType.HALF, 2025, LocalDate.of(2025, 6, 30), Correction.ORIGINAL),
                LocalDate.of(2025, 8, 14), null, "예시전자", NOW);
        Report cur = Report.create(curRceptNo, CORP, curName,
                new ParsedReportName(ReportType.HALF, 2026, LocalDate.of(2026, 6, 30), Correction.ORIGINAL),
                LocalDate.of(2026, 8, 14), null, "예시전자", NOW);
        return new CompletedAnalysis(analysis, prev, cur);
    }

    private static void setId(Analysis analysis, long id) {
        try {
            Field field = Analysis.class.getDeclaredField("id");
            field.setAccessible(true);
            field.set(analysis, id);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
    }
}
