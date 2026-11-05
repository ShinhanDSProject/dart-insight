package com.dartinsight.textevent.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dartinsight.aiserver.client.AiServerPaths;
import com.dartinsight.aiserver.client.FakeAiServer;
import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.domain.TextComparison;
import com.dartinsight.analysis.domain.TextStatus;
import com.dartinsight.analysis.repository.AnalysisRepository;
import com.dartinsight.analysis.service.AnalysisResultService;
import com.dartinsight.company.service.CompanyImportService;
import com.dartinsight.comparison.domain.ComparisonBasis;
import com.dartinsight.dart.domain.CorpCodeEntry;
import com.dartinsight.financial.domain.FsDiv;
import com.dartinsight.report.domain.Correction;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.domain.ReportNameParser.ParsedReportName;
import com.dartinsight.report.domain.ReportType;
import com.dartinsight.report.repository.ReportRepository;
import com.dartinsight.support.TestData;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/** 기본 설정(TEXT_EVENTS_ENABLED 없음)에서는 사건을 만들지 않는다(ADR-0050). */
@SpringBootTest
@AutoConfigureMockMvc
class TextEventDisabledApiTest {

    private static final FakeAiServer AI = new FakeAiServer();
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 11, 5, 9, 0);

    @DynamicPropertySource
    static void servers(DynamicPropertyRegistry registry) {
        registry.add("app.ai-server.base-url", AI::baseUrl);
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private CompanyImportService companyImportService;

    @Autowired
    private ReportRepository reportRepository;

    @Autowired
    private AnalysisRepository analysisRepository;

    @Autowired
    private AnalysisResultService resultService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    @DisplayName("꺼 두면 시작해도 NOT_CREATED(DISABLED)이고 ai-server를 부르지 않으며 실행을 저장하지 않는다")
    void disabledByDefault() throws Exception {
        TestData.clearAll(jdbcTemplate);
        companyImportService.save(List.of(
                new CorpCodeEntry("00000001", "예시전자", null, "900001", LocalDate.of(2026, 1, 1))));
        for (int year : new int[] {2025, 2026}) {
            reportRepository.save(Report.create(year + "0814000001", "00000001", "반기보고서 (" + year + ".06)",
                    new ParsedReportName(ReportType.HALF, year, LocalDate.of(year, 6, 30), Correction.ORIGINAL),
                    LocalDate.of(year, 8, 14), null, "예시전자", NOW));
        }
        Analysis analysis = Analysis.request("00000001", "20260814000001", "20250814000001", ComparisonBasis.YOY, null,
                NOW);
        analysis.start(NOW);
        analysis.recordFsDiv(FsDiv.CFS);
        Long id = analysisRepository.save(analysis).getId();
        resultService.saveAndComplete(id, List.of(), new TextComparison(TextStatus.COMPLETED, null, List.of()));

        mockMvc.perform(post("/api/analyses/" + id + "/event-runs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NOT_CREATED"))
                .andExpect(jsonPath("$.notCreatedReason").value("DISABLED"));
        mockMvc.perform(get("/api/analyses/" + id + "/events"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ANALYSIS_EVENTS_NOT_CREATED"));

        assertThat(AI.requests(AiServerPaths.TEXT_EVENTS)).isEmpty();
        Integer runs = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM text_event_run", Integer.class);
        assertThat(runs).isZero();
    }
}
