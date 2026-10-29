package com.dartinsight.comparison.controller;

import static com.dartinsight.dart.client.FinancialJson.account;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dartinsight.company.service.CompanyImportService;
import com.dartinsight.dart.domain.CorpCodeEntry;
import com.dartinsight.dart.client.FakeOpenDartServer;
import com.dartinsight.dart.client.FakeOpenDartServer.Response;
import com.dartinsight.dart.client.FinancialJson;
import com.dartinsight.report.domain.Correction;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

@SpringBootTest
@AutoConfigureMockMvc
class ComparabilityControllerTest {

    private static final FakeOpenDartServer SERVER = startServer();
    private static final String PATH = "/api/fnlttSinglAcntAll.json";

    private static final String HALF_2026 = "20260814000001";
    private static final String Q1_2026 = "20260515000001";
    private static final String ANNUAL_2025 = "20260310000001";
    private static final String Q3_2025 = "20251114000001";
    private static final String HALF_2025 = "20250814000001";
    private static final String OTHER_HALF_2025 = "20250814000099";

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
        save(HALF_2026, "00000001", ReportType.HALF, 2026, Correction.ORIGINAL);
        save(Q1_2026, "00000001", ReportType.Q1, 2026, Correction.ORIGINAL);
        save(ANNUAL_2025, "00000001", ReportType.ANNUAL, 2025, Correction.ORIGINAL);
        save(Q3_2025, "00000001", ReportType.Q3, 2025, Correction.ORIGINAL);
        save(HALF_2025, "00000001", ReportType.HALF, 2025, Correction.CORRECTED);
        save(OTHER_HALF_2025, "00000002", ReportType.HALF, 2025, Correction.ORIGINAL);
    }

    private void save(String rceptNo, String corpCode, ReportType type, int year, Correction correction) {
        LocalDate periodEnd = LocalDate.of(year, type.periodEndMonth(), 1).plusMonths(1).minusDays(1);
        reportRepository.save(Report.create(rceptNo, corpCode, type.label(),
                new ParsedReportName(type, year, periodEnd, correction), periodEnd.plusMonths(2), null, "예시",
                LocalDateTime.of(2026, 10, 21, 9, 0)));
    }

    /** 가짜 재무제표: 그 보고서의 접수번호로 된 계정 하나 */
    private static Response statementOf(String rceptNo) {
        return Response.json(FinancialJson.ok(account(rceptNo, "BS", "ifrs-full_Assets", "자산총계", 1, "5000")));
    }

    private static Response noData() {
        return Response.json(FinancialJson.NO_DATA);
    }

    private ResultActions check(String current, String previous, String basis) throws Exception {
        return mockMvc.perform(post("/api/comparability-checks")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"corpCode":"00000001","currentRceptNo":"%s","previousRceptNo":"%s","basis":"%s"}
                        """.formatted(current, previous, basis)));
    }

    private int calls() {
        return (int) SERVER.requests().stream().filter(r -> r.startsWith(PATH)).count();
    }

    @Test
    void sameKindLastYearIsFullyComparable() throws Exception {
        SERVER.on(PATH, statementOf(HALF_2026), statementOf(HALF_2025));

        check(HALF_2026, HALF_2025, "YOY")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.comparable").value(true))
                .andExpect(jsonPath("$.level").value("FULL"))
                .andExpect(jsonPath("$.fsDiv").value("CFS"))
                .andExpect(jsonPath("$.current.rceptNo").value(HALF_2026))
                .andExpect(jsonPath("$.current.financialDataStatus").value("AVAILABLE"))
                .andExpect(jsonPath("$.previous.rceptNo").value(HALF_2025))
                .andExpect(jsonPath("$.checks", hasSize(5)))
                .andExpect(jsonPath("$.checks[0].item").value("COMPANY"))
                .andExpect(jsonPath("$.checks[0].label").value("기업"))
                .andExpect(jsonPath("$.checks[0].status").value("OK"))
                .andExpect(jsonPath("$.checks[1].item").value("REPORT_PERIOD"))
                .andExpect(jsonPath("$.checks[1].status").value("OK"))
                .andExpect(jsonPath("$.checks[1].detail").value("2025 반기 → 2026 반기 (전년 동기)"))
                .andExpect(jsonPath("$.checks[2].item").value("FINANCIAL_BASIS"))
                .andExpect(jsonPath("$.checks[2].detail").value("연결, 원(KRW)"))
                .andExpect(jsonPath("$.checks[3].item").value("CORRECTION"))
                .andExpect(jsonPath("$.checks[3].status").value("WARN"))
                .andExpect(jsonPath("$.checks[4].item").value("DATA_READY"))
                .andExpect(jsonPath("$.checks[4].status").value("OK"))
                .andExpect(jsonPath("$.statements", hasSize(5)))
                .andExpect(jsonPath("$.statements[1].sjDiv").value("IS"))
                .andExpect(jsonPath("$.statements[1].amountBasis").value("CUMULATIVE"))
                .andExpect(jsonPath("$.statements[3].comparable").value(true))
                .andExpect(jsonPath("$.reasons", hasSize(0)));
    }

    @Test
    void differentInterimReportsCompareBalanceSheetAndQuarterIncome() throws Exception {
        SERVER.on(PATH, statementOf(HALF_2026), statementOf(Q1_2026));

        check(HALF_2026, Q1_2026, "PREV")
                .andExpect(jsonPath("$.comparable").value(true))
                .andExpect(jsonPath("$.level").value("PARTIAL"))
                .andExpect(jsonPath("$.checks[1].status").value("WARN"))
                .andExpect(jsonPath("$.statements[0].amountBasis").value("POINT"))
                .andExpect(jsonPath("$.statements[1].amountBasis").value("QUARTER"))
                .andExpect(jsonPath("$.statements[3].sjDiv").value("CF"))
                .andExpect(jsonPath("$.statements[3].comparable").value(false))
                .andExpect(jsonPath("$.statements[3].note").isNotEmpty());
    }

    @Test
    void annualAgainstQuarterComparesBalanceSheetOnly() throws Exception {
        SERVER.on(PATH, statementOf(ANNUAL_2025), statementOf(Q3_2025));

        check(ANNUAL_2025, Q3_2025, "PREV")
                .andExpect(jsonPath("$.level").value("PARTIAL"))
                .andExpect(jsonPath("$.statements[0].comparable").value(true))
                .andExpect(jsonPath("$.statements[1].comparable").value(false))
                .andExpect(jsonPath("$.statements[2].comparable").value(false));
    }

    @Test
    void differentCompanyIsBlockedWithoutCallingOpenDart() throws Exception {
        int before = calls();

        check(HALF_2026, OTHER_HALF_2025, "CUSTOM")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.comparable").value(false))
                .andExpect(jsonPath("$.level").value("NOT_COMPARABLE"))
                .andExpect(jsonPath("$.fsDiv").value(nullValue()))
                .andExpect(jsonPath("$.checks[0].status").value("FAIL"))
                .andExpect(jsonPath("$.checks[2].status").value("SKIPPED"))
                .andExpect(jsonPath("$.checks[4].status").value("SKIPPED"))
                .andExpect(jsonPath("$.reasons[0].code").value("DIFFERENT_COMPANY"))
                .andExpect(jsonPath("$.reasons[0].nextAction").isNotEmpty())
                .andExpect(jsonPath("$.statements", hasSize(5)))
                .andExpect(jsonPath("$.statements[*].comparable", everyItem(is(false))))
                .andExpect(jsonPath("$.statements[*].amountBasis", everyItem(nullValue())));
        assertThat(calls()).isEqualTo(before);
    }

    @Test
    void previousMustBeEarlier() throws Exception {
        check(HALF_2025, HALF_2026, "CUSTOM")
                .andExpect(jsonPath("$.comparable").value(false))
                .andExpect(jsonPath("$.reasons[0].code").value("PREVIOUS_NOT_EARLIER"))
                .andExpect(jsonPath("$.statements[*].comparable", everyItem(is(false))));
        check(HALF_2026, HALF_2026, "CUSTOM")
                .andExpect(jsonPath("$.reasons[0].code").value("SAME_REPORT"))
                .andExpect(jsonPath("$.statements[*].comparable", everyItem(is(false))))
                .andExpect(jsonPath("$.statements[0].note")
                        .value("비교할 수 없는 보고서 쌍이라 재무제표를 비교하지 않아요."));
    }

    @Test
    void missingFinancialDataBlocksInsteadOfMakingNumbers() throws Exception {
        // 현재 연결 있음, 이전 연결 없음 → 별도도 확인: 현재 있음, 이전 없음
        SERVER.on(PATH, statementOf(HALF_2026), noData(), statementOf(HALF_2026), noData());

        check(HALF_2026, HALF_2025, "YOY")
                .andExpect(jsonPath("$.comparable").value(false))
                .andExpect(jsonPath("$.checks[2].status").value("FAIL"))
                .andExpect(jsonPath("$.checks[4].status").value("FAIL"))
                .andExpect(jsonPath("$.reasons[0].code").value("NO_FINANCIAL_DATA"))
                .andExpect(jsonPath("$.reasons[0].message").value(containsString("비교 보고서")));
    }

    @Test
    void separateStatementsAreUsedWhenBothLackConsolidated() throws Exception {
        SERVER.on(PATH, noData(), statementOf(HALF_2025), statementOf(HALF_2026), statementOf(HALF_2025));

        check(HALF_2026, HALF_2025, "YOY")
                .andExpect(jsonPath("$.comparable").value(true))
                .andExpect(jsonPath("$.fsDiv").value("OFS"))
                .andExpect(jsonPath("$.checks[2].status").value("WARN"));
    }

    @Test
    void dataOfAnotherReceiptNumberIsNotUsed() throws Exception {
        SERVER.on(PATH, statementOf(HALF_2026), statementOf("20250901000001"), noData(), noData());

        check(HALF_2026, HALF_2025, "YOY")
                .andExpect(jsonPath("$.comparable").value(false))
                .andExpect(jsonPath("$.reasons[0].code").value("DATA_VERSION_MISMATCH"));
    }

    /**
     * 목록을 다시 받았을 때 그 보고서만 최신 목록에 없던 것처럼 만든다(정정 공시로 대체됨).
     * 회사의 목록 받은 시각보다 lastSeenAt이 앞서면 대체된 보고서다(ReportService.get).
     */
    private void replacedByCorrection(String rceptNo) {
        LocalDateTime fetchedAt = LocalDateTime.of(2026, 10, 21, 9, 0);
        jdbcTemplate.update("UPDATE company SET reports_fetched_at = ? WHERE corp_code = ?", fetchedAt, "00000001");
        jdbcTemplate.update("UPDATE report SET last_seen_at = ? WHERE rcept_no = ?", fetchedAt.minusDays(1), rceptNo);
    }

    /** 가짜 재무제표: 계정 하나를 다른 통화로 */
    private static Response statementInCurrency(String rceptNo, String currency) {
        return Response.json(FinancialJson.ok(account(rceptNo, "BS", "ifrs-full_Assets", "자산총계", 1, "5000")
                .replace("\"currency\":\"KRW\"", "\"currency\":\"" + currency + "\"")));
    }

    @Test
    @DisplayName("정정 공시로 대체된 보고서를 고르면 REPLACED_BY_CORRECTION과 정정본을 고르라는 안내를 돌려준다")
    void reportReplacedByCorrectionIsBlocked() throws Exception {
        replacedByCorrection(HALF_2025);
        SERVER.on(PATH, statementOf(HALF_2026), statementOf(HALF_2025));

        check(HALF_2026, HALF_2025, "YOY")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.comparable").value(false))
                .andExpect(jsonPath("$.level").value("NOT_COMPARABLE"))
                .andExpect(jsonPath("$.checks[3].item").value("CORRECTION"))
                .andExpect(jsonPath("$.checks[3].status").value("FAIL"))
                .andExpect(jsonPath("$.reasons", hasSize(1)))
                .andExpect(jsonPath("$.reasons[0].code").value("REPLACED_BY_CORRECTION"))
                .andExpect(jsonPath("$.reasons[0].message").value("비교 보고서는 정정 공시로 대체된 보고서예요."))
                .andExpect(jsonPath("$.reasons[0].nextAction").value("목록에서 정정본(최종)을 고르세요."));
    }

    @Test
    @DisplayName("한 보고서는 연결만, 다른 보고서는 별도만 있으면 NO_COMMON_BASIS를 돌려준다")
    void noCommonStatementBasisIsBlocked() throws Exception {
        // 부르는 순서: 현재 연결(있음), 이전 연결(없음), 현재 별도(없음), 이전 별도(있음)
        SERVER.on(PATH, statementOf(HALF_2026), noData(), noData(), statementOf(HALF_2025));

        check(HALF_2026, HALF_2025, "YOY")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.comparable").value(false))
                .andExpect(jsonPath("$.fsDiv").value(nullValue()))
                .andExpect(jsonPath("$.checks[2].status").value("FAIL"))
                .andExpect(jsonPath("$.checks[4].status").value("FAIL"))
                .andExpect(jsonPath("$.reasons", hasSize(1)))
                .andExpect(jsonPath("$.reasons[0].code").value("NO_COMMON_BASIS"))
                .andExpect(jsonPath("$.statements[*].comparable", everyItem(is(false))))
                .andExpect(jsonPath("$.reasons[0].nextAction").value("같은 기준의 재무제표가 있는 다른 보고서를 고르세요."));
    }

    @Test
    @DisplayName("두 보고서의 재무제표 통화가 다르면 CURRENCY_MISMATCH를 돌려준다")
    void differentCurrencyIsBlocked() throws Exception {
        SERVER.on(PATH, statementInCurrency(HALF_2026, "USD"), statementOf(HALF_2025));

        check(HALF_2026, HALF_2025, "YOY")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.comparable").value(false))
                .andExpect(jsonPath("$.checks[2].item").value("FINANCIAL_BASIS"))
                .andExpect(jsonPath("$.checks[2].status").value("FAIL"))
                .andExpect(jsonPath("$.checks[2].detail").value("연결, 통화 [KRW] / [USD]"))
                .andExpect(jsonPath("$.reasons", hasSize(1)))
                .andExpect(jsonPath("$.reasons[0].code").value("CURRENCY_MISMATCH"))
                .andExpect(jsonPath("$.reasons[0].nextAction").value("같은 통화로 작성된 보고서를 고르세요."));
    }

    @Test
    void basisMismatchIsWarned() throws Exception {
        SERVER.on(PATH, statementOf(HALF_2026), statementOf(Q3_2025));

        check(HALF_2026, Q3_2025, "YOY")
                .andExpect(jsonPath("$.comparable").value(true))
                .andExpect(jsonPath("$.checks[1].status").value("WARN"))
                .andExpect(jsonPath("$.checks[1].detail").value(containsString("직접 고른")));
    }

    @Test
    @DisplayName("본문의 basis가 정해진 값이 아니면 400과 errors[].field=basis, 허용 값을 돌려준다")
    void unknownBasisListsAllowedValues() throws Exception {
        check(HALF_2026, HALF_2025, "FOO")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"))
                .andExpect(jsonPath("$.errors", hasSize(1)))
                .andExpect(jsonPath("$.errors[0].field").value("basis"))
                .andExpect(jsonPath("$.errors[0].reason").value("허용 값: YOY, PREV, CUSTOM"));
    }

    @Test
    void invalidRequest() throws Exception {
        mockMvc.perform(post("/api/comparability-checks").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"corpCode\":\"00000001\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"))
                .andExpect(jsonPath("$.errors", hasSize(3)));
        check(HALF_2026, "20990101000001", "YOY")
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("REPORT_NOT_FOUND"));
    }
}
