package com.dartinsight.financial.service;

import static com.dartinsight.dart.client.FinancialJson.account;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.company.service.CompanyImportService;
import com.dartinsight.dart.domain.CorpCodeEntry;
import com.dartinsight.dart.client.FakeOpenDartServer;
import com.dartinsight.dart.client.FakeOpenDartServer.Response;
import com.dartinsight.dart.client.FinancialJson;
import com.dartinsight.financial.domain.FetchStatus;
import com.dartinsight.financial.domain.FinancialAccount;
import com.dartinsight.financial.domain.FinancialStatementFetch;
import com.dartinsight.financial.domain.FsDiv;
import com.dartinsight.financial.repository.FinancialAccountRepository;
import com.dartinsight.report.domain.Correction;
import com.dartinsight.report.domain.FinancialDataStatus;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.domain.ReportNameParser.ParsedReportName;
import com.dartinsight.report.repository.ReportRepository;
import com.dartinsight.report.domain.ReportType;
import com.dartinsight.support.TestData;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

@SpringBootTest
class FinancialStatementServiceTest {

    private static final FakeOpenDartServer SERVER = startServer();
    private static final String PATH = "/api/fnlttSinglAcntAll.json";

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
    private FinancialStatementService service;

    @Autowired
    private FinancialAccountRepository accountRepository;

    @Autowired
    private ReportRepository reportRepository;

    @Autowired
    private CompanyImportService companyImportService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private Report half2026;

    @BeforeEach
    void setUp() {
        TestData.clearAll(jdbcTemplate);
        companyImportService.save(List.of(
                new CorpCodeEntry("00000001", "예시전자", null, "900001", LocalDate.of(2026, 1, 1))));
        half2026 = saveReport("20260814000001", ReportType.HALF, 2026, LocalDate.of(2026, 6, 30));
    }

    private Report saveReport(String rceptNo, ReportType type, int year, LocalDate periodEnd) {
        return saveReport(rceptNo, type, year, periodEnd, LocalDateTime.of(2026, 10, 21, 9, 0));
    }

    private Report saveReport(String rceptNo, ReportType type, int year, LocalDate periodEnd,
            LocalDateTime lastSeenAt) {
        return reportRepository.save(Report.create(rceptNo, "00000001", type.label(),
                new ParsedReportName(type, year, periodEnd, Correction.ORIGINAL), periodEnd.plusMonths(2), null,
                "예시전자", lastSeenAt));
    }

    private int calls() {
        return (int) SERVER.requests().stream().filter(r -> r.startsWith(PATH)).count();
    }

    @Test
    void storesAccountsByStatementWithEvidenceAndDoesNotCallAgain() {
        SERVER.on(PATH, Response.json(FinancialJson.ok(
                account("20260814000001", "BS", "ifrs-full_Assets", "자산총계", 1, "5,000", "", "4,000"),
                account("20260814000001", "IS", "ifrs-full_Revenue", "수익(매출액)", 1,
                        "300", "550", "", "280", "500"),
                account("20260814000001", "CF", "-표준계정코드 미사용-", "기타 현금흐름", 9, "", "", "-"))));
        int before = calls();

        FinancialStatementFetch fetch = service.fetch(half2026, FsDiv.CFS).orElseThrow();

        assertThat(fetch.getStatus()).isEqualTo(FetchStatus.OK);
        assertThat(fetch.getRceptNo()).isEqualTo("20260814000001");
        assertThat(fetch.getReprtCode()).isEqualTo("11012");
        assertThat(fetch.getFsDiv()).isEqualTo(FsDiv.CFS);
        List<FinancialAccount> accounts = service.accounts(fetch);
        assertThat(accounts).extracting(FinancialAccount::getSjDiv).containsExactly("BS", "CF", "IS");
        FinancialAccount assets = accounts.get(0);
        assertThat(assets.getRceptNo()).isEqualTo("20260814000001");
        assertThat(assets.getAccountId()).isEqualTo("ifrs-full_Assets");
        assertThat(assets.getThstrmAmount()).isEqualTo(5000L);
        assertThat(assets.getFrmtrmAmount()).isEqualTo(4000L);
        assertThat(assets.getCurrency()).isEqualTo("KRW");
        assertThat(assets.getAccountDetail()).isNull();
        FinancialAccount revenue = accounts.get(2);
        assertThat(revenue.getThstrmAmount()).as("3개월").isEqualTo(300L);
        assertThat(revenue.getThstrmAddAmount()).as("누적").isEqualTo(550L);
        assertThat(revenue.getFrmtrmQAmount()).isEqualTo(280L);
        assertThat(revenue.getFrmtrmAddAmount()).isEqualTo(500L);
        FinancialAccount other = accounts.get(1);
        assertThat(other.isStandardAccount()).isFalse();
        assertThat(other.getThstrmAmount()).as("없는 값은 0이 아니라 null").isNull();
        assertThat(calls() - before).isEqualTo(1);

        service.fetch(half2026, FsDiv.CFS);
        assertThat(calls() - before).as("저장된 결과를 쓴다").isEqualTo(1);
    }

    @Test
    void noDataIsStoredAndNotCalledAgain() {
        SERVER.on(PATH, Response.json(FinancialJson.NO_DATA));
        int before = calls();

        FinancialStatementFetch fetch = service.fetch(half2026, FsDiv.CFS).orElseThrow();
        service.fetch(half2026, FsDiv.CFS);

        assertThat(fetch.getStatus()).isEqualTo(FetchStatus.NO_DATA);
        assertThat(service.accounts(fetch)).isEmpty();
        assertThat(calls() - before).isEqualTo(1);
    }

    @Test
    void failureIsNotStored() {
        SERVER.on(PATH, Response.json(FinancialJson.RATE_LIMITED));

        assertThatThrownBy(() -> service.fetch(half2026, FsDiv.CFS))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).errorCode())
                .isEqualTo(ErrorCode.DART_RATE_LIMITED);

        SERVER.on(PATH, Response.json(FinancialJson.ok(
                account("20260814000001", "BS", "ifrs-full_Assets", "자산총계", 1, "5000"))));
        assertThat(service.fetch(half2026, FsDiv.CFS)).get()
                .extracting(FinancialStatementFetch::getStatus).isEqualTo(FetchStatus.OK);
    }

    @Test
    void separateStatementIsUsedWhenThereIsNoConsolidated() {
        SERVER.on(PATH, Response.json(FinancialJson.NO_DATA), Response.json(FinancialJson.ok(
                account("20260814000001", "BS", "ifrs-full_Assets", "자산총계", 1, "5000"))));
        int before = calls();

        FinancialStatementFetch fetch = service.fetchPreferConsolidated(half2026).orElseThrow();

        assertThat(fetch.getFsDiv()).isEqualTo(FsDiv.OFS);
        assertThat(fetch.hasData()).isTrue();
        List<String> requests = SERVER.requests().subList(SERVER.requests().size() - 2, SERVER.requests().size());
        assertThat(requests.get(0)).contains("fs_div=CFS");
        assertThat(requests.get(1)).contains("fs_div=OFS");
        assertThat(calls() - before).isEqualTo(2);
    }

    @Test
    void correctedFilingIsFetchedAgainAndReplacesTheOldValues() {
        SERVER.on(PATH, Response.json(FinancialJson.ok(
                account("20260814000001", "BS", "ifrs-full_Assets", "자산총계", 1, "5000"),
                account("20260814000001", "BS", "ifrs-full_Liabilities", "부채총계", 2, "3000"))));
        FinancialStatementFetch original = service.fetch(half2026, FsDiv.CFS).orElseThrow();
        // 정정 공시가 나중에 목록에 들어옴
        Report corrected = saveReport("20260902000001", ReportType.HALF, 2026, LocalDate.of(2026, 6, 30),
                LocalDateTime.now().plusDays(1));
        SERVER.on(PATH, Response.json(FinancialJson.ok(
                account("20260902000001", "BS", "ifrs-full_Assets", "자산총계", 1, "5100"))));
        int before = calls();

        FinancialStatementFetch refreshed = service.fetch(corrected, FsDiv.CFS).orElseThrow();

        assertThat(calls() - before).isEqualTo(1);
        assertThat(refreshed.getId()).isEqualTo(original.getId());
        assertThat(refreshed.getRceptNo()).isEqualTo("20260902000001");
        assertThat(service.accounts(refreshed)).singleElement()
                .satisfies(a -> assertThat(a.getThstrmAmount()).isEqualTo(5100L));
        assertThat(service.statuses("00000001", List.of(half2026, corrected)))
                .containsEntry("20260814000001", FinancialDataStatus.NOT_AVAILABLE)
                .containsEntry("20260902000001", FinancialDataStatus.AVAILABLE);
        service.fetch(corrected, FsDiv.CFS);
        service.fetch(half2026, FsDiv.CFS);
        assertThat(calls() - before).as("이 보고서의 자료가 있거나 옛 보고서면 다시 부르지 않는다").isEqualTo(1);
    }

    @Test
    void noDataIsAskedAgainOnlyAfterTheReportIsSeenAgain() {
        SERVER.on(PATH, Response.json(FinancialJson.NO_DATA));
        service.fetch(half2026, FsDiv.CFS);
        int before = calls();
        jdbcTemplate.update("UPDATE report SET last_seen_at = ? WHERE rcept_no = ?", LocalDateTime.now().plusDays(1),
                half2026.getRceptNo());
        Report seenAgain = reportRepository.findByRceptNo(half2026.getRceptNo()).orElseThrow();
        assertThat(service.statuses("00000001", List.of(seenAgain)))
                .containsEntry(half2026.getRceptNo(), FinancialDataStatus.UNKNOWN);
        SERVER.on(PATH, Response.json(FinancialJson.ok(
                account("20260814000001", "BS", "ifrs-full_Assets", "자산총계", 1, "5000"))));

        assertThat(service.fetch(seenAgain, FsDiv.CFS)).get()
                .extracting(FinancialStatementFetch::getStatus).isEqualTo(FetchStatus.OK);
        assertThat(calls() - before).isEqualTo(1);
    }

    @Test
    void reportsBefore2015AreNotRequested() {
        Report annual2014 = saveReport("20150331000001", ReportType.ANNUAL, 2014, LocalDate.of(2014, 12, 31));
        int before = calls();

        assertThat(service.fetch(annual2014, FsDiv.CFS)).isEmpty();
        assertThat(calls()).isEqualTo(before);
    }

    @Test
    void dataStatusFollowsStoredResults() {
        Report q1 = saveReport("20260515000001", ReportType.Q1, 2026, LocalDate.of(2026, 3, 31));
        Report annual = saveReport("20260310000001", ReportType.ANNUAL, 2025, LocalDate.of(2025, 12, 31));
        Report q3 = saveReport("20251114000001", ReportType.Q3, 2025, LocalDate.of(2025, 9, 30));
        Report old = saveReport("20150331000001", ReportType.ANNUAL, 2014, LocalDate.of(2014, 12, 31));
        // 반기: 연결 자료 있음
        SERVER.on(PATH, Response.json(FinancialJson.ok(
                account("20260814000001", "BS", "ifrs-full_Assets", "자산총계", 1, "5000"))));
        service.fetch(half2026, FsDiv.CFS);
        // 1분기: 연결·별도 모두 자료 없음
        SERVER.on(PATH, Response.json(FinancialJson.NO_DATA));
        service.fetch(q1, FsDiv.CFS);
        service.fetch(q1, FsDiv.OFS);
        // 사업: 연결만 자료 없음을 확인함(별도는 아직)
        service.fetch(annual, FsDiv.CFS);
        // 3분기: 자료가 다른 접수번호(정정본) 것
        SERVER.on(PATH, Response.json(FinancialJson.ok(
                account("20251201000001", "BS", "ifrs-full_Assets", "자산총계", 1, "5000"))));
        service.fetch(q3, FsDiv.CFS);

        Map<String, FinancialDataStatus> statuses = service.statuses("00000001",
                List.of(half2026, q1, annual, q3, old));

        assertThat(statuses).containsEntry("20260814000001", FinancialDataStatus.AVAILABLE)
                .containsEntry("20260515000001", FinancialDataStatus.NOT_AVAILABLE)
                .containsEntry("20260310000001", FinancialDataStatus.UNKNOWN)
                .containsEntry("20251114000001", FinancialDataStatus.NOT_AVAILABLE)
                .containsEntry("20150331000001", FinancialDataStatus.NOT_AVAILABLE);
        assertThat(accountRepository.count()).isEqualTo(2);
    }
}
