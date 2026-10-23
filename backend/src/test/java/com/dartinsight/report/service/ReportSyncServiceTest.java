package com.dartinsight.report.service;

import static com.dartinsight.dart.client.DisclosureListJson.item;
import static com.dartinsight.dart.client.DisclosureListJson.page;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.company.domain.Company;
import com.dartinsight.company.service.CompanyImportService;
import com.dartinsight.company.repository.CompanyRepository;
import com.dartinsight.dart.domain.CorpCodeEntry;
import com.dartinsight.dart.client.DisclosureListJson;
import com.dartinsight.dart.client.FakeOpenDartServer;
import com.dartinsight.dart.client.FakeOpenDartServer.Response;
import com.dartinsight.report.domain.Correction;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.domain.ReportType;
import com.dartinsight.report.repository.ReportRepository;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

@SpringBootTest
class ReportSyncServiceTest {

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
    private ReportSyncService syncService;

    @Autowired
    private ReportRepository reportRepository;

    @Autowired
    private CompanyRepository companyRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private CompanyImportService companyImportService;

    @Autowired
    private Clock clock;

    @BeforeEach
    void setUp() {
        TestData.clearAll(jdbcTemplate);
        companyImportService.save(List.of(
                new CorpCodeEntry("00000001", "예시전자", null, "900001", LocalDate.of(2026, 1, 1)),
                new CorpCodeEntry("00000002", "예시화학", null, "900002", LocalDate.of(2026, 1, 1))));
    }

    private List<Report> latest(String corpCode) {
        Company company = companyRepository.findById(corpCode).orElseThrow();
        return reportRepository.findByCorpCodeAndLastSeenAtGreaterThanEqualOrderByPeriodEndDescRceptDtDesc(
                corpCode, company.getReportsFetchedAt());
    }

    private void makeStale(String corpCode) {
        Company company = companyRepository.findById(corpCode).orElseThrow();
        company.markReportsFetched(LocalDateTime.now(clock).minusDays(2));
        companyRepository.save(company);
    }

    @Test
    void savesSupportedReportsAndSkipsOthers() {
        SERVER.on("/api/list.json", Response.json(page(1, 1,
                item("20260814000001", "반기보고서 (2026.06)", "20260814", ""),
                item("20260515000001", "분기보고서 (2026.03)", "20260515", ""),
                item("20260310000001", "[기재정정]사업보고서 (2025.12)", "20260310", "정"),
                item("20260320000009", "소액공모법인결산서류 (2025.12)", "20260320", ""),
                item("20250630000001", "사업보고서 (2025.03)", "20250630", ""))));

        ReportSyncService.SyncResult result = syncService.refreshIfStale("00000001");

        assertThat(result.fetched()).isTrue();
        assertThat(result.created()).isEqualTo(3);
        assertThat(result.skipped()).isEqualTo(2);
        assertThat(latest("00000001")).extracting(Report::getRceptNo)
                .containsExactly("20260814000001", "20260515000001", "20260310000001");
        assertThat(reportRepository.findById("20260310000001")).get()
                .satisfies(r -> {
                    assertThat(r.getReportType()).isEqualTo(ReportType.ANNUAL);
                    assertThat(r.getCorrection()).isEqualTo(Correction.CORRECTED);
                    assertThat(r.getFiscalYear()).isEqualTo(2025);
                });
    }

    @Test
    void doesNotCallAgainWhileFresh() {
        SERVER.on("/api/list.json", Response.json(page(1, 1,
                item("20260814000001", "반기보고서 (2026.06)", "20260814", ""))));
        syncService.refreshIfStale("00000001");
        int calls = SERVER.requests().size();

        ReportSyncService.SyncResult second = syncService.refreshIfStale("00000001");

        assertThat(second.fetched()).isFalse();
        assertThat(SERVER.requests()).hasSize(calls);
    }

    @Test
    void correctedReportReplacesOriginalInLatestListButOriginalIsKept() {
        SERVER.on("/api/list.json", Response.json(page(1, 1,
                item("20260814000001", "반기보고서 (2026.06)", "20260814", ""))));
        syncService.refreshIfStale("00000001");
        makeStale("00000001");
        SERVER.on("/api/list.json", Response.json(page(1, 1,
                item("20260902000001", "[기재정정]반기보고서 (2026.06)", "20260902", "정"))));

        ReportSyncService.SyncResult result = syncService.refreshIfStale("00000001");

        assertThat(result.created()).isEqualTo(1);
        assertThat(latest("00000001")).extracting(Report::getRceptNo).containsExactly("20260902000001");
        assertThat(reportRepository.findById("20260814000001")).isPresent();
    }

    @Test
    void usesSavedListWhenRefreshFails() {
        SERVER.on("/api/list.json", Response.json(page(1, 1,
                item("20260814000001", "반기보고서 (2026.06)", "20260814", ""))));
        syncService.refreshIfStale("00000001");
        makeStale("00000001");
        SERVER.on("/api/list.json", Response.json(DisclosureListJson.RATE_LIMITED));

        ReportSyncService.SyncResult result = syncService.refreshIfStale("00000001");

        assertThat(result.cacheFallbackError()).isEqualTo(ErrorCode.DART_RATE_LIMITED);
        assertThat(latest("00000001")).extracting(Report::getRceptNo).containsExactly("20260814000001");
    }

    @Test
    void failsWhenNothingIsSaved() {
        SERVER.on("/api/list.json", Response.json(DisclosureListJson.RATE_LIMITED));

        assertThatThrownBy(() -> syncService.refreshIfStale("00000002"))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).errorCode())
                .isEqualTo(ErrorCode.DART_RATE_LIMITED);
    }

    @Test
    void unknownCompanyIsNotFound() {
        assertThatThrownBy(() -> syncService.refreshIfStale("99999999"))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).errorCode())
                .isEqualTo(ErrorCode.COMPANY_NOT_FOUND);
    }
}
