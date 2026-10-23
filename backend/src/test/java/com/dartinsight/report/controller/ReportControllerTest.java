package com.dartinsight.report.controller;

import static com.dartinsight.dart.client.DisclosureListJson.item;
import static com.dartinsight.dart.client.DisclosureListJson.page;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.matchesPattern;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dartinsight.company.domain.Company;
import com.dartinsight.company.service.CompanyImportService;
import com.dartinsight.company.repository.CompanyRepository;
import com.dartinsight.dart.dto.CorpCodeEntry;
import com.dartinsight.dart.client.DisclosureListJson;
import com.dartinsight.dart.client.FakeOpenDartServer;
import com.dartinsight.dart.client.FakeOpenDartServer.Response;
import com.dartinsight.support.TestData;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.Clock;
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
class ReportControllerTest {

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
    private CompanyRepository companyRepository;

    @Autowired
    private CompanyImportService companyImportService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private Clock clock;

    @BeforeEach
    void setUp() {
        TestData.clearAll(jdbcTemplate);
        companyImportService.save(List.of(
                new CorpCodeEntry("00000001", "예시전자", null, "900001", LocalDate.of(2026, 1, 1))));
    }

    @Test
    void listsReportsNewestPeriodFirst() throws Exception {
        SERVER.on("/api/list.json", Response.json(page(1, 1,
                item("20260515000001", "분기보고서 (2026.03)", "20260515", ""),
                item("20260814000001", "반기보고서 (2026.06)", "20260814", ""),
                item("20260310000001", "[기재정정]사업보고서 (2025.12)", "20260310", "정"),
                item("20150331000001", "사업보고서 (2014.12)", "20150331", ""))));

        mockMvc.perform(get("/api/companies/00000001/reports"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.corpCode").value("00000001"))
                .andExpect(jsonPath("$.fetchedAt").value(matchesPattern("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}")))
                .andExpect(jsonPath("$.refreshError").value(nullValue()))
                .andExpect(jsonPath("$.items", hasSize(4)))
                .andExpect(jsonPath("$.items[0].rceptNo").value("20260814000001"))
                .andExpect(jsonPath("$.items[0].reportName").value("반기보고서 (2026.06)"))
                .andExpect(jsonPath("$.items[0].reportType").value("HALF"))
                .andExpect(jsonPath("$.items[0].disclosureType").value("A002"))
                .andExpect(jsonPath("$.items[0].fiscalYear").value(2026))
                .andExpect(jsonPath("$.items[0].periodEnd").value("2026-06-30"))
                .andExpect(jsonPath("$.items[0].receivedAt").value("2026-08-14"))
                .andExpect(jsonPath("$.items[0].correction").value("ORIGINAL"))
                .andExpect(jsonPath("$.items[0].financialDataStatus").value("UNKNOWN"))
                .andExpect(jsonPath("$.items[0].dartUrl")
                        .value("https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260814000001"))
                .andExpect(jsonPath("$.items[1].reportType").value("Q1"))
                .andExpect(jsonPath("$.items[1].disclosureType").value("A003"))
                .andExpect(jsonPath("$.items[2].reportType").value("ANNUAL"))
                .andExpect(jsonPath("$.items[2].disclosureType").value("A001"))
                .andExpect(jsonPath("$.items[2].correction").value("CORRECTED"))
                .andExpect(jsonPath("$.items[3].fiscalYear").value(2014))
                .andExpect(jsonPath("$.items[3].financialDataStatus").value("NOT_AVAILABLE"));
    }

    @Test
    void noReportsIsEmptyList() throws Exception {
        SERVER.on("/api/list.json", Response.json(DisclosureListJson.NO_DATA));

        mockMvc.perform(get("/api/companies/00000001/reports"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fetchedAt").isNotEmpty())
                .andExpect(jsonPath("$.items", hasSize(0)));
    }

    @Test
    void savedListIsReturnedWithReasonWhenRefreshFails() throws Exception {
        SERVER.on("/api/list.json", Response.json(page(1, 1,
                item("20260814000001", "반기보고서 (2026.06)", "20260814", ""))));
        mockMvc.perform(get("/api/companies/00000001/reports")).andExpect(status().isOk());
        Company company = companyRepository.findById("00000001").orElseThrow();
        company.markReportsFetched(LocalDateTime.now(clock).minusDays(2));
        companyRepository.save(company);
        SERVER.on("/api/list.json", Response.json(DisclosureListJson.RATE_LIMITED));

        mockMvc.perform(get("/api/companies/00000001/reports"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.refreshError").value("DART_RATE_LIMITED"))
                .andExpect(jsonPath("$.items", hasSize(1)));
    }

    @Test
    void failsWhenNothingIsSaved() throws Exception {
        SERVER.on("/api/list.json", Response.json(DisclosureListJson.RATE_LIMITED));

        mockMvc.perform(get("/api/companies/00000001/reports"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("DART_RATE_LIMITED"));
    }

    @Test
    void unknownCompanyIsNotFound() throws Exception {
        mockMvc.perform(get("/api/companies/99999999/reports"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COMPANY_NOT_FOUND"));
    }

    private void fetchList(String... items) throws Exception {
        SERVER.on("/api/list.json", Response.json(page(1, 1, items)));
        mockMvc.perform(get("/api/companies/00000001/reports")).andExpect(status().isOk());
    }

    private void makeStale() {
        Company company = companyRepository.findById("00000001").orElseThrow();
        company.markReportsFetched(LocalDateTime.now(clock).minusDays(2));
        companyRepository.save(company);
    }

    @Test
    void reportMetadataKeepsPeriodAndReceivedDateApart() throws Exception {
        fetchList(item("20260310000001", "[기재정정]사업보고서 (2025.12)", "20260310", "정"));

        mockMvc.perform(get("/api/reports/20260310000001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rceptNo").value("20260310000001"))
                .andExpect(jsonPath("$.corpCode").value("00000001"))
                .andExpect(jsonPath("$.corpName").value("예시전자"))
                .andExpect(jsonPath("$.reportName").value("[기재정정]사업보고서 (2025.12)"))
                .andExpect(jsonPath("$.reportType").value("ANNUAL"))
                .andExpect(jsonPath("$.disclosureType").value("A001"))
                .andExpect(jsonPath("$.fiscalYear").value(2025))
                .andExpect(jsonPath("$.periodEnd").value("2025-12-31"))
                .andExpect(jsonPath("$.receivedAt").value("2026-03-10"))
                .andExpect(jsonPath("$.correction").value("CORRECTED"))
                .andExpect(jsonPath("$.remark").value("정"))
                .andExpect(jsonPath("$.filerName").value("예시전자"))
                .andExpect(jsonPath("$.latest").value(true))
                .andExpect(jsonPath("$.financialDataStatus").value("UNKNOWN"))
                .andExpect(jsonPath("$.dartUrl").value("https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260310000001"));
    }

    @Test
    void emptyRemarkIsNull() throws Exception {
        fetchList(item("20260814000001", "반기보고서 (2026.06)", "20260814", ""));

        mockMvc.perform(get("/api/reports/20260814000001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.correction").value("ORIGINAL"))
                .andExpect(jsonPath("$.remark").value(nullValue()));
    }

    @Test
    void reportReplacedByCorrectionIsNotLatest() throws Exception {
        fetchList(item("20260814000001", "반기보고서 (2026.06)", "20260814", ""));
        makeStale();
        fetchList(item("20260902000001", "[기재정정]반기보고서 (2026.06)", "20260902", "정"));

        mockMvc.perform(get("/api/reports/20260814000001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.latest").value(false));
        mockMvc.perform(get("/api/reports/20260902000001"))
                .andExpect(jsonPath("$.latest").value(true));
    }

    @Test
    void unknownReportIsNotFound() throws Exception {
        mockMvc.perform(get("/api/reports/20990101000001"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("REPORT_NOT_FOUND"));
    }
}
