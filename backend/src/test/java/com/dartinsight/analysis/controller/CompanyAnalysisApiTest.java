package com.dartinsight.analysis.controller;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.repository.AnalysisRepository;
import com.dartinsight.company.service.CompanyImportService;
import com.dartinsight.comparison.domain.ComparisonBasis;
import com.dartinsight.dart.domain.CorpCodeEntry;
import com.dartinsight.report.domain.Correction;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.domain.ReportNameParser.ParsedReportName;
import com.dartinsight.report.domain.ReportType;
import com.dartinsight.report.repository.ReportRepository;
import com.dartinsight.support.TestData;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class CompanyAnalysisApiTest {

    private static final String CORP = "00000001";
    private static final String OTHER_CORP = "00000002";
    private static final String H2026 = "20260814000001";
    private static final String H2025 = "20250814000001";
    private static final String Q1_2026 = "20260515000001";
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 24, 9, 0);

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private CompanyImportService companyImportService;

    @Autowired
    private ReportRepository reportRepository;

    @Autowired
    private AnalysisRepository analysisRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        TestData.clearAll(jdbcTemplate);
        companyImportService.save(List.of(
                new CorpCodeEntry(CORP, "예시전자", null, "900001", LocalDate.of(2026, 1, 1)),
                new CorpCodeEntry(OTHER_CORP, "다른전자", null, "900002", LocalDate.of(2026, 1, 1))));
        saveReport(H2026, ReportType.HALF, "반기보고서 (2026.06)", LocalDate.of(2026, 6, 30));
        saveReport(H2025, ReportType.HALF, "반기보고서 (2025.06)", LocalDate.of(2025, 6, 30));
        saveReport(Q1_2026, ReportType.Q1, "분기보고서 (2026.03)", LocalDate.of(2026, 3, 31));
    }

    private void saveReport(String rceptNo, ReportType type, String name, LocalDate periodEnd) {
        reportRepository.save(Report.create(rceptNo, CORP, name,
                new ParsedReportName(type, periodEnd.getYear(), periodEnd, Correction.ORIGINAL),
                periodEnd.plusMonths(2), null, "예시전자", NOW));
    }

    private Long completed(String corpCode, String current, String previous, ComparisonBasis basis,
            LocalDateTime completedAt) {
        Analysis analysis = Analysis.request(corpCode, current, previous, basis, null, completedAt.minusMinutes(1));
        analysis.start(completedAt.minusMinutes(1));
        analysis.complete(completedAt);
        return analysisRepository.save(analysis).getId();
    }

    @Test
    @DisplayName("완료된 분석을 최근 완료 순으로 보고서 이름·기간과 함께 돌려준다")
    void listsCompletedAnalysesNewestFirst() throws Exception {
        Long older = completed(CORP, H2026, H2025, ComparisonBasis.YOY, NOW.minusDays(2));
        Long newer = completed(CORP, H2026, Q1_2026, ComparisonBasis.PREV, NOW);

        mockMvc.perform(get("/api/companies/{corpCode}/analyses", CORP))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.items[0].analysisId").value(newer))
                .andExpect(jsonPath("$.items[0].basis").value("PREV"))
                .andExpect(jsonPath("$.items[0].completedAt").value("2026-10-24T09:00:00"))
                .andExpect(jsonPath("$.items[1].analysisId").value(older))
                .andExpect(jsonPath("$.items[1].basis").value("YOY"))
                .andExpect(jsonPath("$.items[1].previous.rceptNo").value(H2025))
                .andExpect(jsonPath("$.items[1].previous.reportName").value("반기보고서 (2025.06)"))
                .andExpect(jsonPath("$.items[1].previous.periodEnd").value("2025-06-30"))
                .andExpect(jsonPath("$.items[1].current.rceptNo").value(H2026))
                .andExpect(jsonPath("$.items[1].current.reportName").value("반기보고서 (2026.06)"))
                .andExpect(jsonPath("$.items[1].current.periodEnd").value("2026-06-30"));
    }

    @Test
    @DisplayName("대기·진행·실패한 분석과 다른 기업의 분석은 넣지 않는다")
    void excludesNotCompletedAndOtherCompanies() throws Exception {
        Long done = completed(CORP, H2026, H2025, ComparisonBasis.YOY, NOW);
        analysisRepository.save(Analysis.request(CORP, H2026, Q1_2026, ComparisonBasis.PREV, null, NOW));
        Analysis running = Analysis.request(CORP, H2026, H2025, ComparisonBasis.CUSTOM, null, NOW);
        running.start(NOW);
        analysisRepository.save(running);
        Analysis failed = Analysis.request(CORP, Q1_2026, H2025, ComparisonBasis.CUSTOM, null, NOW);
        failed.start(NOW);
        failed.fail("ANALYSIS_FAILED", "실패", NOW.plusMinutes(1));
        analysisRepository.save(failed);
        completed(OTHER_CORP, H2026, H2025, ComparisonBasis.YOY, NOW.plusHours(1));

        mockMvc.perform(get("/api/companies/{corpCode}/analyses", CORP))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].analysisId").value(done));
    }

    @Test
    @DisplayName("같은 보고서 쌍·비교 기준을 여러 번 분석했으면 가장 최근에 완료된 것만 돌려준다")
    void keepsOnlyLatestOfSamePairAndBasis() throws Exception {
        completed(CORP, H2026, H2025, ComparisonBasis.YOY, NOW.minusDays(3));
        Long latest = completed(CORP, H2026, H2025, ComparisonBasis.YOY, NOW);
        Long custom = completed(CORP, H2026, H2025, ComparisonBasis.CUSTOM, NOW.minusDays(1));

        mockMvc.perform(get("/api/companies/{corpCode}/analyses", CORP))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.items[0].analysisId").value(latest))
                .andExpect(jsonPath("$.items[1].analysisId").value(custom));
    }

    @Test
    @DisplayName("기본 5개, limit을 주면 그 개수까지만 돌려준다")
    void limitsItems() throws Exception {
        List<String> reports = List.of(H2026, Q1_2026, H2025);
        for (int i = 0; i < reports.size(); i++) {
            for (ComparisonBasis basis : ComparisonBasis.values()) {
                completed(CORP, reports.get(i), reports.get((i + 1) % reports.size()), basis,
                        NOW.minusHours(i * 3L + basis.ordinal()));
            }
        }

        mockMvc.perform(get("/api/companies/{corpCode}/analyses", CORP))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(5)));
        mockMvc.perform(get("/api/companies/{corpCode}/analyses", CORP).param("limit", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.items[0].completedAt").value("2026-10-24T09:00:00"))
                .andExpect(jsonPath("$.items[0].previous.reportName").value("분기보고서 (2026.03)"));
    }

    @Test
    @DisplayName("분석이 없는 기업이면 빈 목록이다")
    void emptyWhenNoAnalyses() throws Exception {
        mockMvc.perform(get("/api/companies/{corpCode}/analyses", OTHER_CORP))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(0)));
    }

    @Test
    @DisplayName("없는 기업이면 404 COMPANY_NOT_FOUND")
    void unknownCompanyIsNotFound() throws Exception {
        mockMvc.perform(get("/api/companies/{corpCode}/analyses", "99999999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COMPANY_NOT_FOUND"));
    }

    @Test
    @DisplayName("limit이 1~20 밖이거나 숫자가 아니면 400 COMMON_INVALID_INPUT")
    void invalidLimitIsInvalidInput() throws Exception {
        for (String limit : List.of("0", "21", "abc")) {
            mockMvc.perform(get("/api/companies/{corpCode}/analyses", CORP).param("limit", limit))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"))
                    .andExpect(jsonPath("$.errors[0].field").value("limit"));
        }
    }
}
