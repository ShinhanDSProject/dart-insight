package com.dartinsight.analysis;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dartinsight.analysis.TextChangeRow.Priority;
import com.dartinsight.analysis.TextChangeRow.Side;
import com.dartinsight.company.service.CompanyImportService;
import com.dartinsight.comparison.ComparisonBasis;
import com.dartinsight.dart.dto.CorpCodeEntry;
import com.dartinsight.report.domain.Correction;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.service.ReportNameParser.ParsedReportName;
import com.dartinsight.report.repository.ReportRepository;
import com.dartinsight.report.domain.ReportType;
import com.dartinsight.support.TestData;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

/** 변경 항목 우선순위(2.6): 저장한 점수 순 정렬, 판단 유보는 뒤에, 적용한 규칙 함께 */
@SpringBootTest
@AutoConfigureMockMvc
class TextChangePriorityTest {

    private static final String CUR = "20260814000001";
    private static final String PREV = "20250814000001";
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 21, 9, 0);

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AnalysisResultService resultService;

    @Autowired
    private AnalysisRepository analysisRepository;

    @Autowired
    private CompanyImportService companyImportService;

    @Autowired
    private ReportRepository reportRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private Long analysisId;

    @BeforeEach
    void setUp() {
        TestData.clearAll(jdbcTemplate);
        companyImportService.save(List.of(
                new CorpCodeEntry("00000001", "예시전자", null, "900001", LocalDate.of(2026, 1, 1))));
        for (int year : new int[] {2025, 2026}) {
            reportRepository.save(Report.create(year == 2026 ? CUR : PREV, "00000001", "반기보고서 (" + year + ".06)",
                    new ParsedReportName(ReportType.HALF, year, LocalDate.of(year, 6, 30), Correction.ORIGINAL),
                    LocalDate.of(year, 8, 14), null, "예시전자", NOW));
        }
        Analysis analysis = Analysis.request("00000001", CUR, PREV, ComparisonBasis.YOY, null, NOW);
        analysis.start(NOW);
        analysisId = analysisRepository.save(analysis).getId();
        resultService.saveAndComplete(analysisId, List.of(), new TextComparison(TextStatus.COMPLETED, null, List.of(
                row("첫 번째(낮음)", "LOW", 15, List.of("그 밖의 섹션 +5", "문단 +10")),
                review("두 번째(판단 유보)"),
                row("세 번째(높음)", "HIGH", 60, List.of("사업의 내용 섹션 +30", "문장·표 추가 +20", "문단 +10")),
                row("네 번째(중간)", "MEDIUM", 45, List.of("경영진단 및 분석의견 섹션 +25", "문장·표 추가 +20")))));
    }

    private static TextChangeRow row(String text, String level, int score, List<String> reasons) {
        return new TextChangeRow(TextChangeRow.ADDED, "PARAGRAPH", false, "MATCHED", "t", "p", null,
                new Side(CUR, 1, text.length(), text), null, null, new Priority(level, score, reasons, "priority-1"));
    }

    private static TextChangeRow review(String reason) {
        return new TextChangeRow(TextChangeRow.REVIEW_NEEDED, TextChangeRow.SECTION, false, "AMBIGUOUS", "t", "p",
                null, new Side(CUR, 2, null, null), null, reason,
                new Priority(Priority.UNRANKED, null, List.of("판단 유보"), "priority-1"));
    }

    @Test
    void defaultOrderIsByPriorityWithUnrankedLast() throws Exception {
        mockMvc.perform(get("/api/analyses/{id}/text-changes", analysisId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sort").value("priority"))
                .andExpect(jsonPath("$.items[*].priority.level").value(contains("HIGH", "MEDIUM", "LOW", "UNRANKED")))
                .andExpect(jsonPath("$.items[0].priority.score").value(60))
                .andExpect(jsonPath("$.items[0].priority.reasons[0]").value("사업의 내용 섹션 +30"))
                .andExpect(jsonPath("$.items[3].priority.score").doesNotExist());
    }

    @Test
    void documentOrderIsAvailable() throws Exception {
        mockMvc.perform(get("/api/analyses/{id}/text-changes", analysisId).param("sort", "document"))
                .andExpect(jsonPath("$.items[*].changeNo").value(contains(1, 2, 3, 4)));
    }

    @Test
    void unknownSortIsRejected() throws Exception {
        mockMvc.perform(get("/api/analyses/{id}/text-changes", analysisId).param("sort", "score"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("sort"));
    }

    @Test
    void onlyReviewNeededMayBeUnranked() {
        Analysis analysis = analysisRepository.findById(analysisId).orElseThrow();
        TextChangeRow unrankedAddition = new TextChangeRow(TextChangeRow.ADDED, "PARAGRAPH", false, "MATCHED", "t",
                "p", null, new Side(CUR, 1, 3, "글"), null, null,
                new Priority(Priority.UNRANKED, null, List.of(), "priority-1"));
        TextChangeRow rankedReview = new TextChangeRow(TextChangeRow.REVIEW_NEEDED, TextChangeRow.SECTION, false,
                "AMBIGUOUS", "t", "p", null, new Side(CUR, 2, null, null), null, "사유",
                new Priority("LOW", 5, List.of(), "priority-1"));

        assertThat(AnalysisRunner.verifyText(analysis, List.of(unrankedAddition)))
                .contains("순위");
        assertThat(AnalysisRunner.verifyText(analysis, List.of(rankedReview)))
                .contains("순위");
    }
}
