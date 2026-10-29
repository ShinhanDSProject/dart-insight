package com.dartinsight.analysis.controller;

import static com.dartinsight.dart.client.FinancialJson.account;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.repository.AnalysisRepository;
import com.dartinsight.analysis.service.AnalysisRunner;
import com.dartinsight.common.config.ClockConfig;
import com.dartinsight.company.service.CompanyImportService;
import com.dartinsight.comparison.domain.ComparisonBasis;
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
import com.jayway.jsonpath.JsonPath;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
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
class AnalysisApiTest {

    private static final FakeOpenDartServer SERVER = startServer();
    private static final String PATH = "/api/fnlttSinglAcntAll.json";
    private static final String CUR = "20260814000001";
    private static final String PREV = "20250814000001";
    private static final String Q3_PREV = "20251114000001";
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 21, 9, 0);

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
    private AnalysisRepository analysisRepository;

    @Autowired
    private AnalysisRunner runner;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        TestData.clearAll(jdbcTemplate);
        companyImportService.save(List.of(
                new CorpCodeEntry("00000001", "예시전자", null, "900001", LocalDate.of(2026, 1, 1))));
        saveReport(CUR, 2026);
        saveReport(PREV, 2025);
        reportRepository.save(Report.create(Q3_PREV, "00000001", "분기보고서 (2025.09)",
                new ParsedReportName(ReportType.Q3, 2025, LocalDate.of(2025, 9, 30), Correction.ORIGINAL),
                LocalDate.of(2025, 11, 14), null, "예시전자", NOW));
    }

    private void saveReport(String rceptNo, int year) {
        reportRepository.save(Report.create(rceptNo, "00000001", "반기보고서 (" + year + ".06)",
                new ParsedReportName(ReportType.HALF, year, LocalDate.of(year, 6, 30), Correction.ORIGINAL),
                LocalDate.of(year, 8, 14), null, "예시전자", NOW));
    }

    /** 가짜 재무제표: 자산총계와 매출액(3개월, 누적) */
    private static Response statementOf(String rceptNo, String assets, String revenueQuarter, String revenueTotal) {
        return Response.json(FinancialJson.ok(
                account(rceptNo, "BS", "ifrs-full_Assets", "자산총계", 1, assets),
                account(rceptNo, "IS", "ifrs-full_Revenue", "매출액", 1, revenueQuarter, revenueTotal)));
    }

    private void givenStatements() {
        SERVER.on(PATH, statementOf(CUR, "1153", "40", "70"), statementOf(PREV, "1000", "30", "55"));
    }

    private ResultActions request(String current, String previous) throws Exception {
        return request(current, previous, "YOY");
    }

    private ResultActions request(String current, String previous, String basis) throws Exception {
        return mockMvc.perform(post("/api/analyses")
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Trace-Id", "trace-analysis-1")
                .content("""
                        {"corpCode":"00000001","currentRceptNo":"%s","previousRceptNo":"%s","basis":"%s"}
                        """.formatted(current, previous, basis)));
    }

    private int calls() {
        return (int) SERVER.requests().stream().filter(r -> r.startsWith(PATH)).count();
    }

    @Test
    void requestRunsUntilResultsAreSaved() throws Exception {
        givenStatements();

        String body = request(CUR, PREV)
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.reused").value(false))
                .andReturn().getResponse().getContentAsString();
        long id = ((Number) JsonPath.read(body, "$.analysisId")).longValue();

        mockMvc.perform(get("/api/analyses/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.corpName").value("예시전자"))
                .andExpect(jsonPath("$.basis").value("YOY"))
                .andExpect(jsonPath("$.fsDiv").value("CFS"))
                .andExpect(jsonPath("$.current.rceptNo").value(CUR))
                .andExpect(jsonPath("$.previous.rceptNo").value(PREV))
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.step").value("DONE"))
                .andExpect(jsonPath("$.steps", hasSize(4)))
                .andExpect(jsonPath("$.steps[0].label").value("요청 접수"))
                .andExpect(jsonPath("$.steps[3].state").value("DONE"))
                .andExpect(jsonPath("$.error").value(nullValue()))
                .andExpect(jsonPath("$.completedAt").isNotEmpty())
                .andExpect(jsonPath("$.analysisVersion").value(Analysis.CURRENT_VERSION))
                .andExpect(jsonPath("$.outdated").value(false));
        mockMvc.perform(get("/api/analyses/{id}/financial-changes", id).param("sjDiv", "IS"))
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].previousAmount").value(55))
                .andExpect(jsonPath("$.items[0].currentAmount").value(70))
                .andExpect(jsonPath("$.items[0].changeAmount").value(15))
                // 자본변동표가 아니면 계정 상세는 null(#401)
                .andExpect(jsonPath("$.items[0].accountDetail").value(nullValue()));
        assertThat(analysisRepository.findById(id).orElseThrow().getRequestTraceId())
                .isEqualTo("trace-analysis-1");
    }

    @Test
    @DisplayName("이전·현재 값이 모두 없는 계정(빈 값·'-')은 재무 수치 변화와 계정 수에서 빠진다(#355)")
    void accountsWithoutAnyValueAreNotListed() throws Exception {
        SERVER.on(PATH,
                Response.json(FinancialJson.ok(
                        account(CUR, "BS", "ifrs-full_Assets", "자산총계", 1, "1153"),
                        account(CUR, "BS", "ifrs-full_Liabilities", "부채총계", 2, "-"),
                        account(CUR, "BS", "ifrs-full_DerivativeFinancialAssets", "파생상품자산", 3, "-"),
                        account(CUR, "BS", "ifrs-full_Inventories", "재고자산", 4, ""))),
                Response.json(FinancialJson.ok(
                        account(PREV, "BS", "ifrs-full_Assets", "자산총계", 1, "1000"),
                        account(PREV, "BS", "ifrs-full_Liabilities", "부채총계", 2, ""),
                        account(PREV, "BS", "ifrs-full_Inventories", "재고자산", 3, "0"))));

        String body = request(CUR, PREV).andExpect(status().isAccepted()).andReturn().getResponse()
                .getContentAsString();
        long id = ((Number) JsonPath.read(body, "$.analysisId")).longValue();

        mockMvc.perform(get("/api/analyses/{id}/financial-changes", id).param("sjDiv", "BS"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.statements[?(@.sjDiv == 'BS')].total").value(2))
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.items[0].accountName").value("자산총계"))
                .andExpect(jsonPath("$.items[0].calcStatus").value("OK"))
                // 이전 값 0은 없는 값이 아니어서 남는다
                .andExpect(jsonPath("$.items[1].accountName").value("재고자산"))
                .andExpect(jsonPath("$.items[1].previousAmount").value(0))
                .andExpect(jsonPath("$.items[1].currentAmount").value(nullValue()))
                .andExpect(jsonPath("$.items[1].calcStatus").value("CURRENT_MISSING"));
    }

    @Test
    void sameRequestReusesCompletedResultWithoutCallingAgain() throws Exception {
        givenStatements();
        long first = ((Number) JsonPath.read(request(CUR, PREV).andReturn().getResponse().getContentAsString(),
                "$.analysisId")).longValue();
        markTextCompared(first);
        int callsAfterFirst = calls();

        request(CUR, PREV)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.analysisId").value(first))
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.reused").value(true));
        assertThat(calls()).isEqualTo(callsAfterFirst);
        assertThat(analysisRepository.count()).isEqualTo(1);
    }

    @Test
    void resultWhoseTextComparisonFailedIsNotReused() throws Exception {
        givenStatements();
        long first = ((Number) JsonPath.read(request(CUR, PREV).andReturn().getResponse().getContentAsString(),
                "$.analysisId")).longValue();
        mockMvc.perform(get("/api/analyses/{id}", first))
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.textStatus").value("FAILED"));

        // 문장 비교가 일시 장애로 실패했을 수 있으므로 같은 요청은 새로 분석한다
        request(CUR, PREV)
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.reused").value(false))
                .andExpect(jsonPath("$.analysisId").value(not((int) first)));
        assertThat(analysisRepository.count()).isEqualTo(2);
    }

    /**
     * 이 테스트 클래스는 원문·AI 서버 없이 돌아 문장 비교가 실패(FAILED)로 남는다.
     * 완료 결과 재사용을 보려고 문장 비교가 끝난 것으로 바꿔 둔다.
     */
    private void markTextCompared(long analysisId) {
        jdbcTemplate.update("UPDATE analysis SET text_status = 'COMPLETED', text_message = NULL WHERE id = ?",
                analysisId);
    }

    @Test
    @DisplayName("정정 공시로 대체된 보고서면 422 ANALYSIS_NOT_COMPARABLE이고 분석을 만들지 않는다")
    void reportReplacedByCorrectionIsRejected() throws Exception {
        // 회사의 목록 받은 시각보다 lastSeenAt이 앞서면 최신 목록에 없는(정정으로 대체된) 보고서다
        jdbcTemplate.update("UPDATE company SET reports_fetched_at = ? WHERE corp_code = ?", NOW, "00000001");
        jdbcTemplate.update("UPDATE report SET last_seen_at = ? WHERE rcept_no = ?", NOW.minusDays(1), PREV);
        givenStatements();

        request(CUR, PREV)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("ANALYSIS_NOT_COMPARABLE"))
                .andExpect(jsonPath("$.message").value("비교 보고서는 정정 공시로 대체된 보고서예요."));
        assertThat(analysisRepository.count()).isZero();
    }

    @Test
    @DisplayName("두 보고서에 같은 기준(연결·별도)의 재무제표가 없으면 422이고 분석을 만들지 않는다")
    void noCommonStatementBasisIsRejected() throws Exception {
        // 부르는 순서: 현재 연결(있음), 이전 연결(없음), 현재 별도(없음), 이전 별도(있음)
        SERVER.on(PATH, statementOf(CUR, "1153", "40", "70"), Response.json(FinancialJson.NO_DATA),
                Response.json(FinancialJson.NO_DATA), statementOf(PREV, "1000", "30", "55"));

        request(CUR, PREV)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("ANALYSIS_NOT_COMPARABLE"))
                .andExpect(jsonPath("$.message").value("두 보고서에 같은 기준(연결·별도)의 재무제표가 없어요."));
        assertThat(analysisRepository.count()).isZero();
    }

    @Test
    @DisplayName("두 보고서의 통화가 다르면 422이고 분석을 만들지 않는다")
    void differentCurrencyIsRejected() throws Exception {
        String usd = FinancialJson.ok(account(CUR, "BS", "ifrs-full_Assets", "자산총계", 1, "1153"))
                .replace("\"currency\":\"KRW\"", "\"currency\":\"USD\"");
        SERVER.on(PATH, Response.json(usd), statementOf(PREV, "1000", "30", "55"));

        request(CUR, PREV)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("ANALYSIS_NOT_COMPARABLE"))
                .andExpect(jsonPath("$.message").value("두 보고서의 통화가 달라요."));
        assertThat(analysisRepository.count()).isZero();
    }

    @Test
    @DisplayName("본문의 basis가 정해진 값이 아니면 400과 errors[].field=basis를 돌려주고 분석을 만들지 않는다")
    void unknownBasisListsAllowedValues() throws Exception {
        request(CUR, PREV, "FOO")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"))
                .andExpect(jsonPath("$.errors", hasSize(1)))
                .andExpect(jsonPath("$.errors[0].field").value("basis"))
                .andExpect(jsonPath("$.errors[0].reason").value("허용 값: YOY, PREV, CUSTOM"));
        assertThat(analysisRepository.count()).isZero();
    }

    @Test
    void notComparablePairIsRejected() throws Exception {
        request(PREV, CUR)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("ANALYSIS_NOT_COMPARABLE"))
                .andExpect(jsonPath("$.message").isNotEmpty());
        assertThat(analysisRepository.count()).isZero();
    }

    @Test
    void failureStaysAtItsStepAndCanBeRequestedAgain() throws Exception {
        Analysis analysis = analysisRepository.save(
                Analysis.request("00000001", CUR, PREV, ComparisonBasis.YOY, "trace-2", NOW));
        SERVER.on(PATH, Response.json(FinancialJson.RATE_LIMITED));

        runner.run(analysis.getId());

        mockMvc.perform(get("/api/analyses/{id}", analysis.getId()))
                .andExpect(jsonPath("$.status").value("FAILED"))
                .andExpect(jsonPath("$.step").value("COMPARING"))
                .andExpect(jsonPath("$.steps[0].state").value("DONE"))
                .andExpect(jsonPath("$.steps[1].state").value("FAILED"))
                .andExpect(jsonPath("$.steps[2].state").value("PENDING"))
                .andExpect(jsonPath("$.error.code").value("DART_RATE_LIMITED"))
                .andExpect(jsonPath("$.error.retryable").value(true));

        givenStatements();
        request(CUR, PREV)
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.reused").value(false))
                .andExpect(jsonPath("$.analysisId").value(not(analysis.getId().intValue())));
    }

    @Test
    void pairThatDoesNotMatchBasisIsStoredAsCustom() throws Exception {
        SERVER.on(PATH, statementOf(CUR, "1153", "40", "70"), statementOf(Q3_PREV, "1100", "35", "90"));

        long id = ((Number) JsonPath.read(request(CUR, Q3_PREV, "YOY").andExpect(status().isAccepted())
                .andReturn().getResponse().getContentAsString(), "$.analysisId")).longValue();

        mockMvc.perform(get("/api/analyses/{id}", id))
                .andExpect(jsonPath("$.basis").value("CUSTOM"))
                .andExpect(jsonPath("$.status").value("COMPLETED"));
        markTextCompared(id);
        request(CUR, Q3_PREV, "CUSTOM")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.analysisId").value(id))
                .andExpect(jsonPath("$.reused").value(true));
    }

    @Test
    void customRequestForYearOverYearPairIsStoredAsYoy() throws Exception {
        givenStatements();

        long id = ((Number) JsonPath.read(request(CUR, PREV, "CUSTOM").andExpect(status().isAccepted())
                .andReturn().getResponse().getContentAsString(), "$.analysisId")).longValue();

        mockMvc.perform(get("/api/analyses/{id}", id))
                .andExpect(jsonPath("$.basis").value("YOY"));
        markTextCompared(id);
        int callsAfterFirst = calls();
        // 같은 쌍을 전년 동기로 다시 요청해도 새로 분석하지 않는다
        request(CUR, PREV, "YOY")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.analysisId").value(id))
                .andExpect(jsonPath("$.reused").value(true));
        assertThat(calls()).isEqualTo(callsAfterFirst);
        assertThat(analysisRepository.count()).isEqualTo(1);
    }

    @Test
    void unfinishedAnalysesFailWhenTheServerStartsAgain() throws Exception {
        Analysis analysis = Analysis.request("00000001", CUR, PREV, ComparisonBasis.YOY, null, NOW);
        analysis.start(NOW);
        Long id = analysisRepository.save(analysis).getId();

        runner.failInterrupted();

        mockMvc.perform(get("/api/analyses/{id}", id))
                .andExpect(jsonPath("$.status").value("FAILED"))
                .andExpect(jsonPath("$.error.code").value("ANALYSIS_INTERRUPTED"))
                .andExpect(jsonPath("$.error.retryable").value(true));
    }

    @Test
    void analysisCreatedWhileTheServerIsStartingIsNotFailed() throws Exception {
        // 웹 서버는 ready 이벤트 전에 요청을 받으므로, 이번 실행에서 만든 분석은 그대로 둔다
        LocalDateTime afterBoot = LocalDateTime.now(ClockConfig.SEOUL).truncatedTo(ChronoUnit.MICROS);
        Analysis analysis = Analysis.request("00000001", CUR, PREV, ComparisonBasis.YOY, null, afterBoot);
        analysis.start(afterBoot);
        Long id = analysisRepository.save(analysis).getId();

        runner.failInterrupted();

        mockMvc.perform(get("/api/analyses/{id}", id))
                .andExpect(jsonPath("$.status").value("RUNNING"));
    }

    @Test
    @DisplayName("분석 버전이 현재 버전과 다르면 상태와 관계없이 outdated가 true다")
    void analysisMadeWithOlderVersionIsOutdatedInEveryStatus() throws Exception {
        Long pending = analysisRepository.save(
                Analysis.request("00000001", CUR, PREV, ComparisonBasis.YOY, null, NOW)).getId();
        Analysis started = Analysis.request("00000001", CUR, Q3_PREV, ComparisonBasis.CUSTOM, null, NOW);
        started.start(NOW);
        Long running = analysisRepository.save(started).getId();
        Analysis failing = analysisRepository.save(
                Analysis.request("00000001", CUR, PREV, ComparisonBasis.YOY, null, NOW));
        SERVER.on(PATH, Response.json(FinancialJson.RATE_LIMITED));
        runner.run(failing.getId());

        mockMvc.perform(get("/api/analyses/{id}", pending))
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.analysisVersion").value(Analysis.CURRENT_VERSION))
                .andExpect(jsonPath("$.outdated").value(false));

        jdbcTemplate.update("UPDATE analysis SET analysis_version = 'm2-8' WHERE id IN (?, ?, ?)",
                pending, running, failing.getId());
        for (Object[] expected : List.of(new Object[] {pending, "PENDING"}, new Object[] {running, "RUNNING"},
                new Object[] {failing.getId(), "FAILED"})) {
            mockMvc.perform(get("/api/analyses/{id}", expected[0]))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value(expected[1]))
                    .andExpect(jsonPath("$.analysisVersion").value("m2-8"))
                    .andExpect(jsonPath("$.outdated").value(true));
        }
    }

    @Test
    void unknownAnalysisAndInvalidRequest() throws Exception {
        mockMvc.perform(get("/api/analyses/{id}", 999_999))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ANALYSIS_NOT_FOUND"));
        mockMvc.perform(post("/api/analyses").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors", hasSize(4)));
    }
}
