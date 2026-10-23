package com.dartinsight.comparison;

import static com.dartinsight.dart.client.DisclosureListJson.item;
import static com.dartinsight.dart.client.DisclosureListJson.page;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dartinsight.company.CompanyImportService;
import com.dartinsight.dart.dto.CorpCodeEntry;
import com.dartinsight.dart.client.FakeOpenDartServer;
import com.dartinsight.dart.client.FakeOpenDartServer.Response;
import com.dartinsight.report.Correction;
import com.dartinsight.report.Report;
import com.dartinsight.report.ReportNameParser;
import com.dartinsight.report.ReportRepository;
import com.dartinsight.report.ReportType;
import com.dartinsight.support.TestData;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class ReportPairControllerTest {

    private static final FakeOpenDartServer SERVER = startServer();

    @DynamicPropertySource
    static void openDart(DynamicPropertyRegistry registry) {
        registry.add("app.opendart.base-url", SERVER::baseUrl);
        registry.add("app.opendart.read-timeout", () -> "2s");
    }

    private static FakeOpenDartServer startServer() {
        try {
            return new FakeOpenDartServer();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private CompanyImportService companyImportService;

    @Autowired
    private ReportRepository reportRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        TestData.clearAll(jdbcTemplate);
        companyImportService.save(List.of(
                new CorpCodeEntry("00000001", "예시전자", null, "900001", LocalDate.of(2026, 1, 1)),
                new CorpCodeEntry("00000002", "예시화학", null, "900002", LocalDate.of(2026, 1, 1))));
        // 가짜 공시 목록: 2025년 1분기부터 2026년 반기까지
        SERVER.on("/api/list.json", Response.json(page(1, 1,
                item("20260814000001", "반기보고서 (2026.06)", "20260814", ""),
                item("20260515000001", "분기보고서 (2026.03)", "20260515", ""),
                item("20260310000001", "사업보고서 (2025.12)", "20260310", ""),
                item("20251114000001", "분기보고서 (2025.09)", "20251114", ""),
                item("20250814000001", "[기재정정]반기보고서 (2025.06)", "20250901", "정"),
                item("20250515000001", "분기보고서 (2025.03)", "20250515", ""))));
    }

    @Test
    void yoyPairsLatestReportWithSamePeriodLastYear() throws Exception {
        mockMvc.perform(get("/api/companies/00000001/report-pairs").param("basis", "YOY"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.basis").value("YOY"))
                .andExpect(jsonPath("$.current.rceptNo").value("20260814000001"))
                .andExpect(jsonPath("$.current.periodEnd").value("2026-06-30"))
                .andExpect(jsonPath("$.previous.rceptNo").value("20250814000001"))
                .andExpect(jsonPath("$.previous.reportType").value("HALF"))
                .andExpect(jsonPath("$.previous.periodEnd").value("2025-06-30"))
                .andExpect(jsonPath("$.previous.correction").value("CORRECTED"))
                .andExpect(jsonPath("$.reason").value(nullValue()));
    }

    @Test
    void prevPairsWithImmediatelyPrecedingReport() throws Exception {
        expectPrev("20260814000001", "20260515000001"); // 반기 ← 1분기
        expectPrev("20260515000001", "20260310000001"); // 1분기 ← 전년 사업
        expectPrev("20260310000001", "20251114000001"); // 사업 ← 3분기
        expectPrev("20251114000001", "20250814000001"); // 3분기 ← 반기
    }

    private void expectPrev(String current, String previous) throws Exception {
        mockMvc.perform(get("/api/companies/00000001/report-pairs")
                        .param("basis", "PREV").param("currentRceptNo", current))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.current.rceptNo").value(current))
                .andExpect(jsonPath("$.previous.rceptNo").value(previous));
    }

    @Test
    void missingBaseReportGivesReasonInsteadOfAnotherReport() throws Exception {
        mockMvc.perform(get("/api/companies/00000001/report-pairs")
                        .param("basis", "YOY").param("currentRceptNo", "20250515000001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.current.rceptNo").value("20250515000001"))
                .andExpect(jsonPath("$.previous").value(nullValue()))
                .andExpect(jsonPath("$.reason.code").value("NO_BASE_REPORT"))
                .andExpect(jsonPath("$.reason.message").isNotEmpty());
    }

    @Test
    void customAndUnknownBasisAreRejected() throws Exception {
        mockMvc.perform(get("/api/companies/00000001/report-pairs").param("basis", "CUSTOM"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"))
                .andExpect(jsonPath("$.errors[0].field").value("basis"));
        mockMvc.perform(get("/api/companies/00000001/report-pairs").param("basis", "QOQ"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("basis"));
        mockMvc.perform(get("/api/companies/00000001/report-pairs"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void reportOfAnotherCompanyIsNotFound() throws Exception {
        LocalDateTime now = LocalDateTime.of(2026, 10, 21, 9, 0);
        reportRepository.save(Report.create("20260814000099", "00000002", "반기보고서 (2026.06)",
                new ReportNameParser.ParsedReportName(ReportType.HALF, 2026,
                        LocalDate.of(2026, 6, 30), Correction.ORIGINAL),
                LocalDate.of(2026, 8, 14), null, "예시화학", now));

        mockMvc.perform(get("/api/companies/00000001/report-pairs")
                        .param("basis", "YOY").param("currentRceptNo", "20260814000099"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("REPORT_NOT_FOUND"));
    }

    @Test
    void unknownCompanyIsNotFound() throws Exception {
        mockMvc.perform(get("/api/companies/99999999/report-pairs").param("basis", "YOY"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COMPANY_NOT_FOUND"));
    }
}
