package com.dartinsight.checkpoint.controller;

import static com.dartinsight.dart.client.DisclosureListJson.item;
import static com.dartinsight.dart.client.DisclosureListJson.page;
import static com.dartinsight.dart.client.FinancialJson.account;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dartinsight.company.domain.Company;
import com.dartinsight.company.repository.CompanyRepository;
import com.dartinsight.company.service.CompanyImportService;
import com.dartinsight.dart.client.FakeOpenDartServer;
import com.dartinsight.dart.client.FakeOpenDartServer.Response;
import com.dartinsight.dart.client.FinancialJson;
import com.dartinsight.dart.domain.CorpCodeEntry;
import com.dartinsight.report.domain.Correction;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.domain.ReportNameParser.ParsedReportName;
import com.dartinsight.report.domain.ReportType;
import com.dartinsight.report.repository.ReportRepository;
import com.dartinsight.support.TestData;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 회사·금액·공시는 모두 가짜다. 계정 ID·이름은 저장된 실제 응답(삼성전자 2025 사업보고서 20260310002820)과 같은 조합이다.
 */
@SpringBootTest
@AutoConfigureMockMvc
class CheckpointApiTest {

    private static final FakeOpenDartServer DART = startDart();
    private static final String CORP = "00000001";
    private static final String PATH = "/api/companies/" + CORP + "/checkpoints";
    private static final String PREV = "20250311000001";
    private static final String CUR = "20260310000001";
    private static final String FUNDING = "20260901000001";
    private static final String STATEMENTS = "/api/fnlttSinglAcntAll.json";
    private static final String LIST = "/api/list.json";
    private static final String AUDIT = "/api/accnutAdtorNmNdAdtOpinion.json";

    @DynamicPropertySource
    static void servers(DynamicPropertyRegistry registry) {
        registry.add("app.opendart.base-url", DART::baseUrl);
        registry.add("app.opendart.read-timeout", () -> "2s");
        registry.add("app.opendart.max-retries", () -> "0");
    }

    private static FakeOpenDartServer startDart() {
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
    private CompanyRepository companyRepository;

    @Autowired
    private ReportRepository reportRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private Clock clock;

    private LocalDateTime now;

    @BeforeEach
    void setUp() {
        TestData.clearAll(jdbcTemplate);
        now = LocalDateTime.now(clock).truncatedTo(ChronoUnit.MICROS);
        companyImportService.save(List.of(new CorpCodeEntry(CORP, "예시전자", null, "900001", LocalDate.of(2026, 1, 1))));
        Company company = companyRepository.findByCorpCode(CORP).orElseThrow();
        company.markReportsFetched(now);
        companyRepository.save(company);
    }

    private void report(String rceptNo, String name, LocalDate periodEnd) {
        reportRepository.save(Report.create(rceptNo, CORP, name,
                new ParsedReportName(ReportType.ANNUAL, periodEnd.getYear(), periodEnd, Correction.ORIGINAL),
                periodEnd.plusMonths(2), null, "예시전자", now));
    }

    private void bothReports() {
        report(PREV, "사업보고서 (2024.12)", LocalDate.of(2024, 12, 31));
        report(CUR, "사업보고서 (2025.12)", LocalDate.of(2025, 12, 31));
    }

    private String daysAgo(int days) {
        return LocalDate.now(clock).minusDays(days).format(DateTimeFormatter.BASIC_ISO_DATE);
    }

    /** 매출 +10%, 매출채권 +50%(차이 40%p), 재고자산 계정 없음 */
    private static String statements(String rceptNo, String revenue, String receivables, String liabilities,
            String equity, String income, String cash) {
        return FinancialJson.ok(
                account(rceptNo, "BS", "ifrs-full_CurrentTradeReceivables", "매출채권", 14, receivables),
                account(rceptNo, "BS", "ifrs-full_Equity", "자본총계", 29, equity),
                account(rceptNo, "BS", "-표준계정코드 미사용-", "단기차입금", 40, "100"),
                account(rceptNo, "BS", "ifrs-full_Liabilities", "부채총계", 52, liabilities),
                account(rceptNo, "IS", "dart_OperatingIncomeLoss", "영업이익", 6, income),
                account(rceptNo, "IS", "ifrs-full_Revenue", "매출액", 23, revenue),
                account(rceptNo, "CF", "ifrs-full_CashFlowsFromUsedInOperatingActivities", "영업활동현금흐름", 37, cash));
    }

    private static String auditPage(String opinion) {
        return """
                {"status":"000","message":"정상","list":[
                 {"rcept_no":"%1$s","corp_cls":"K","corp_code":"00000001","corp_name":"예시전자","bsns_year":"제16기\\n(당기)",
                  "adtor":"가회계법인","adt_opinion":"%2$s","adt_reprt_spcmnt_matter":"-","emphs_matter":"-",
                  "core_adt_matter":"-","stlm_dt":"2025-12-31"}]}
                """.formatted(CUR, opinion);
    }

    @Test
    @DisplayName("일곱 항목을 상태·수치·계산식·기준값·근거와 함께 돌려주고, 매출채권이 매출보다 빨리 늘면 확인해 볼 점이다")
    void returnsCheckpointsWithEvidence() throws Exception {
        bothReports();
        DART.on(STATEMENTS,
                Response.json(statements(CUR, "1100", "150", "240", "100", "50", "-5")),
                Response.json(statements(PREV, "1000", "100", "200", "100", "40", "30")));
        DART.on(LIST, Response.json(page(1, 1,
                item(FUNDING, "주요사항보고서(유상증자결정)", daysAgo(30), "코"),
                item(CUR, "사업보고서 (2025.12)", daysAgo(200), "코"))));
        DART.on(AUDIT, Response.json(auditPage("적정의견")));

        mockMvc.perform(get(PATH))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.corpCode").value(CORP))
                .andExpect(jsonPath("$.status").value("AVAILABLE"))
                .andExpect(jsonPath("$.reason").value(nullValue()))
                .andExpect(jsonPath("$.currentReport.rceptNo").value(CUR))
                .andExpect(jsonPath("$.currentReport.fiscalYear").value(2025))
                .andExpect(jsonPath("$.previousReport.rceptNo").value(PREV))
                .andExpect(jsonPath("$.fsDiv").value("CFS"))
                .andExpect(jsonPath("$.statementStatus").value("AVAILABLE"))
                .andExpect(jsonPath("$.disclosureTo").value(LocalDate.now(clock).toString()))
                .andExpect(jsonPath("$.items", hasSize(7)))
                // 이익과 현금흐름: 영업이익 흑자, 영업활동현금흐름 음수
                .andExpect(jsonPath("$.items[0].key").value("EARNINGS_QUALITY"))
                .andExpect(jsonPath("$.items[0].status").value("CHECK"))
                .andExpect(jsonPath("$.items[0].statusLabel").value("확인해 볼 점"))
                // 매출채권: 매출 +10.0%, 매출채권 +50.0% → 40.0%p
                .andExpect(jsonPath("$.items[1].key").value("RECEIVABLES"))
                .andExpect(jsonPath("$.items[1].title").value("매출채권"))
                .andExpect(jsonPath("$.items[1].status").value("CHECK"))
                .andExpect(jsonPath("$.items[1].threshold").value("매출채권 증가율 − 매출 증가율이 10%p 이상이면 확인해 볼 점"))
                .andExpect(jsonPath("$.items[1].formula").isNotEmpty())
                .andExpect(jsonPath("$.items[1].why").isNotEmpty())
                .andExpect(jsonPath("$.items[1].facts[0].label").value("매출 (올해)"))
                .andExpect(jsonPath("$.items[1].facts[0].value").value(1100))
                .andExpect(jsonPath("$.items[1].facts[0].unit").value("AMOUNT"))
                .andExpect(jsonPath("$.items[1].facts[0].currency").value("KRW"))
                .andExpect(jsonPath("$.items[1].facts[0].evidence.rceptNo").value(CUR))
                .andExpect(jsonPath("$.items[1].facts[0].evidence.fsDiv").value("CFS"))
                .andExpect(jsonPath("$.items[1].facts[0].evidence.sjDiv").value("IS"))
                .andExpect(jsonPath("$.items[1].facts[0].evidence.statementName").value("손익계산서"))
                .andExpect(jsonPath("$.items[1].facts[0].evidence.accountId").value("ifrs-full_Revenue"))
                .andExpect(jsonPath("$.items[1].facts[0].evidence.accountName").value("매출액"))
                .andExpect(jsonPath("$.items[1].facts[0].evidence.dartUrl")
                        .value("https://dart.fss.or.kr/dsaf001/main.do?rcpNo=" + CUR))
                .andExpect(jsonPath("$.items[1].facts[1].evidence.rceptNo").value(PREV))
                .andExpect(jsonPath("$.items[1].facts[4].label").value("매출 증가율"))
                .andExpect(jsonPath("$.items[1].facts[4].value").value(10.0))
                .andExpect(jsonPath("$.items[1].facts[4].unit").value("PERCENT"))
                .andExpect(jsonPath("$.items[1].facts[5].value").value(50.0))
                .andExpect(jsonPath("$.items[1].facts[6].value").value(40.0))
                .andExpect(jsonPath("$.items[1].facts[6].unit").value("PERCENT_POINT"))
                .andExpect(jsonPath("$.items[1].facts[6].evidence").value(nullValue()))
                // 재고자산 계정이 없으면 0이 아니라 자료 없음
                .andExpect(jsonPath("$.items[2].key").value("INVENTORIES"))
                .andExpect(jsonPath("$.items[2].status").value("NO_DATA"))
                .andExpect(jsonPath("$.items[2].statusLabel").value("자료 없음"))
                .andExpect(jsonPath("$.items[2].facts[2].value").value(nullValue()))
                .andExpect(jsonPath("$.items[2].facts[2].reason").value("MISSING"))
                // 부채비율 200% → 240%(+40%p)
                .andExpect(jsonPath("$.items[3].key").value("DEBT_RATIO"))
                .andExpect(jsonPath("$.items[3].status").value("CHECK"))
                .andExpect(jsonPath("$.items[3].facts[6].value").value(40.0))
                // 단기차입금은 표준계정 미사용이라 이름으로 찾는다. 100 → 100(0.0%), 매출 +10.0%
                .andExpect(jsonPath("$.items[4].key").value("SHORT_TERM_BORROWINGS"))
                .andExpect(jsonPath("$.items[4].status").value("OK"))
                .andExpect(jsonPath("$.items[4].facts[0].evidence.accountName").value("단기차입금"))
                // 자금 조달 공시 1건
                .andExpect(jsonPath("$.items[5].key").value("FUNDING_DISCLOSURES"))
                .andExpect(jsonPath("$.items[5].status").value("CHECK"))
                .andExpect(jsonPath("$.items[5].facts[0].value").value(1))
                .andExpect(jsonPath("$.items[5].facts[0].unit").value("COUNT"))
                .andExpect(jsonPath("$.items[5].disclosures", hasSize(1)))
                .andExpect(jsonPath("$.items[5].disclosures[0].rceptNo").value(FUNDING))
                .andExpect(jsonPath("$.items[5].disclosures[0].reportName").value("주요사항보고서(유상증자결정)"))
                .andExpect(jsonPath("$.items[5].disclosures[0].dartUrl")
                        .value("https://dart.fss.or.kr/dsaf001/main.do?rcpNo=" + FUNDING))
                // 감사의견 적정
                .andExpect(jsonPath("$.items[6].key").value("AUDIT_OPINION"))
                .andExpect(jsonPath("$.items[6].status").value("OK"))
                .andExpect(jsonPath("$.items[6].disclosures", hasSize(0)));

        assertThat(DART.requests()).anyMatch(r -> r.startsWith(STATEMENTS) && r.contains("bsns_year=2025")
                && r.contains("reprt_code=11011") && r.contains("fs_div=CFS"));
        assertThat(DART.requests()).anyMatch(r -> r.startsWith(STATEMENTS) && r.contains("bsns_year=2024")
                && r.contains("fs_div=CFS"));
    }

    @Test
    @DisplayName("저장된 재무제표가 있으면 OpenDART를 다시 부르지 않는다")
    void reusesSavedStatements() throws Exception {
        bothReports();
        DART.on(STATEMENTS,
                Response.json(statements(CUR, "1100", "150", "240", "100", "50", "-5")),
                Response.json(statements(PREV, "1000", "100", "200", "100", "40", "30")));
        DART.on(LIST, Response.json(page(1, 1)));
        mockMvc.perform(get(PATH)).andExpect(status().isOk());
        long before = DART.requests().stream().filter(r -> r.startsWith(STATEMENTS)).count();

        mockMvc.perform(get(PATH))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[1].status").value("CHECK"));

        assertThat(DART.requests().stream().filter(r -> r.startsWith(STATEMENTS)).count()).isEqualTo(before);
    }

    @Test
    @DisplayName("재무제표를 받지 못하면 재무 항목은 자료 없음이고 statementStatus가 FETCH_FAILED다")
    void statementFailureIsNoData() throws Exception {
        bothReports();
        DART.on(STATEMENTS, Response.status(500));
        DART.on(LIST, Response.json(page(1, 1)));

        mockMvc.perform(get(PATH))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("AVAILABLE"))
                .andExpect(jsonPath("$.statementStatus").value("FETCH_FAILED"))
                .andExpect(jsonPath("$.fsDiv").value(nullValue()))
                .andExpect(jsonPath("$.items[0].status").value("NO_DATA"))
                .andExpect(jsonPath("$.items[4].status").value("NO_DATA"))
                .andExpect(jsonPath("$.items[5].status").value("OK"));
    }

    @Test
    @DisplayName("사업보고서가 하나뿐이면 NOT_AVAILABLE과 안내를 돌려준다")
    void singleAnnualReportIsNotAvailable() throws Exception {
        report(CUR, "사업보고서 (2025.12)", LocalDate.of(2025, 12, 31));
        long before = DART.requests().stream().filter(r -> r.startsWith(STATEMENTS)).count();

        mockMvc.perform(get(PATH))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NOT_AVAILABLE"))
                .andExpect(jsonPath("$.reason").value("NO_PREVIOUS_REPORT"))
                .andExpect(jsonPath("$.message").isNotEmpty())
                .andExpect(jsonPath("$.currentReport.rceptNo").value(CUR))
                .andExpect(jsonPath("$.previousReport").value(nullValue()))
                .andExpect(jsonPath("$.statementStatus").value(nullValue()))
                .andExpect(jsonPath("$.items", hasSize(0)));
        assertThat(DART.requests().stream().filter(r -> r.startsWith(STATEMENTS)).count()).isEqualTo(before);
    }

    @Test
    @DisplayName("사업보고서가 없으면 NO_REPORT다")
    void noAnnualReport() throws Exception {
        mockMvc.perform(get(PATH))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NOT_AVAILABLE"))
                .andExpect(jsonPath("$.reason").value("NO_REPORT"))
                .andExpect(jsonPath("$.currentReport").value(nullValue()));
    }

    @Test
    @DisplayName("없는 기업이면 404 COMPANY_NOT_FOUND다")
    void unknownCompany() throws Exception {
        mockMvc.perform(get("/api/companies/99999999/checkpoints"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COMPANY_NOT_FOUND"));
    }
}
