package com.dartinsight.analysis.controller;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.domain.TextChangeRow.Side;
import com.dartinsight.analysis.domain.TextChangeRow;
import com.dartinsight.analysis.domain.TextComparison;
import com.dartinsight.analysis.domain.TextStatus;
import com.dartinsight.analysis.repository.AnalysisRepository;
import com.dartinsight.analysis.service.AnalysisResultService;
import com.dartinsight.company.service.CompanyImportService;
import com.dartinsight.comparison.domain.ComparisonBasis;
import com.dartinsight.dart.dto.CorpCodeEntry;
import com.dartinsight.report.domain.Correction;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.service.ReportNameParser.ParsedReportName;
import com.dartinsight.report.repository.ReportRepository;
import com.dartinsight.report.domain.ReportType;
import com.dartinsight.support.TestData;
import java.math.BigDecimal;
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

@SpringBootTest
@AutoConfigureMockMvc
class TextChangeApiTest {

    private static final String CUR = "20260814000001";
    private static final String PREV = "20250814000001";
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 21, 9, 0);
    private static final String LONG = "가".repeat(300) + " 바뀐 곳은 여기입니다.";

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
        analysisId = completed(new TextComparison(TextStatus.PARTIAL, "현재 보고서 원문 일부를 읽지 못했을 수 있어요.",
                List.of(
                        row(TextChangeRow.MODIFIED, new Side(PREV, 2, 10, LONG + " 이전"),
                                new Side(CUR, 2, 11, LONG + " 현재"), null),
                        row(TextChangeRow.ADDED, null, new Side(CUR, 2, 12, "새 문장"), null),
                        row(TextChangeRow.DELETED, new Side(PREV, 3, 20, "빠진 문장"), null, null),
                        row(TextChangeRow.ADDED, null, new Side(CUR, 3, 21, "두 번째 새 문장"), null),
                        new TextChangeRow(TextChangeRow.REVIEW_NEEDED, TextChangeRow.SECTION, false, "AMBIGUOUS",
                                "가. 기타", "II > 가. 기타", null, new Side(CUR, 4, null, null), null,
                                "짝을 정하지 못했어요."))));
    }

    private static TextChangeRow row(String type, Side previous, Side current, String reason) {
        return new TextChangeRow(type, "PARAGRAPH", false, "MATCHED", "1. 사업의 개요",
                "II. 사업의 내용 > 1. 사업의 개요", previous, current,
                TextChangeRow.MODIFIED.equals(type) ? new BigDecimal("0.9100") : null, reason);
    }

    private Long completed(TextComparison text) {
        Analysis analysis = Analysis.request("00000001", CUR, PREV, ComparisonBasis.YOY, null, NOW);
        analysis.start(NOW);
        Long id = analysisRepository.save(analysis).getId();
        resultService.saveAndComplete(id, List.of(), text);
        return id;
    }

    @Test
    void listsChangesInDocumentOrderWithCounts() throws Exception {
        mockMvc.perform(get("/api/analyses/{id}/text-changes", analysisId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.textStatus").value("PARTIAL"))
                .andExpect(jsonPath("$.textMessage").value("현재 보고서 원문 일부를 읽지 못했을 수 있어요."))
                .andExpect(jsonPath("$.totalItems").value(5))
                .andExpect(jsonPath("$.counts.all").value(5))
                .andExpect(jsonPath("$.counts.added").value(2))
                .andExpect(jsonPath("$.counts.deleted").value(1))
                .andExpect(jsonPath("$.counts.modified").value(1))
                .andExpect(jsonPath("$.counts.reviewNeeded").value(1))
                .andExpect(jsonPath("$.items", hasSize(5)))
                .andExpect(jsonPath("$.items[0].changeNo").value(1))
                .andExpect(jsonPath("$.items[0].changeType").value("MODIFIED"))
                .andExpect(jsonPath("$.items[0].sectionPath").value("II. 사업의 내용 > 1. 사업의 개요"))
                .andExpect(jsonPath("$.items[0].similarity").value(0.91))
                .andExpect(jsonPath("$.items[1].previousPreview").doesNotExist())
                .andExpect(jsonPath("$.items[1].currentPreview").value("새 문장"))
                .andExpect(jsonPath("$.items[4].reviewReason").value("짝을 정하지 못했어요."));
    }

    @Test
    void previewOfALongModificationStartsNearTheFirstDifference() throws Exception {
        mockMvc.perform(get("/api/analyses/{id}/text-changes", analysisId).param("type", "MODIFIED"))
                .andExpect(jsonPath("$.items[0].previousPreview", startsWith("…")))
                .andExpect(jsonPath("$.items[0].currentPreview", startsWith("…")))
                .andExpect(jsonPath("$.items[0].currentPreview", containsString("현재")));
    }

    @Test
    void filtersByTypeAndPages() throws Exception {
        mockMvc.perform(get("/api/analyses/{id}/text-changes", analysisId)
                        .param("type", "ADDED").param("size", "1").param("page", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.type").value("ADDED"))
                .andExpect(jsonPath("$.totalItems").value(2))
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].currentPreview").value("두 번째 새 문장"));
        // 아주 큰 page도 400·500이 아니라 빈 목록(OFFSET이 int로 넘치지 않음)
        mockMvc.perform(get("/api/analyses/{id}/text-changes", analysisId)
                        .param("size", "100").param("page", "1000000000"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(0)));
    }

    @Test
    void badFiltersAreRejected() throws Exception {
        mockMvc.perform(get("/api/analyses/{id}/text-changes", analysisId).param("type", "UNKNOWN"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("type"));
        mockMvc.perform(get("/api/analyses/{id}/text-changes", analysisId).param("size", "101"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void unfinishedAnalysisIsNotReady() throws Exception {
        Long pending = analysisRepository.save(
                Analysis.request("00000001", CUR, PREV, ComparisonBasis.PREV, null, NOW)).getId();

        mockMvc.perform(get("/api/analyses/{id}/text-changes", pending))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ANALYSIS_NOT_READY"));
    }

    @Test
    void failedComparisonHasNoItemsButAReason() throws Exception {
        Long failed = completed(TextComparison.failed("현재 보고서 원문이 OpenDART에 없어 문장을 비교하지 못했어요."));

        mockMvc.perform(get("/api/analyses/{id}/text-changes", failed))
                .andExpect(jsonPath("$.textStatus").value("FAILED"))
                .andExpect(jsonPath("$.textMessage").value(startsWith("현재 보고서 원문이")))
                .andExpect(jsonPath("$.totalItems").value(0));
        mockMvc.perform(get("/api/analyses/{id}", failed))
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.textStatus").value("FAILED"));
    }
}
