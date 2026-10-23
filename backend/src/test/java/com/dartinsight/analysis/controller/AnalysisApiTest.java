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
import com.dartinsight.analysis.domain.CalcStatus;
import com.dartinsight.analysis.domain.FinancialChangeRow.Evidence;
import com.dartinsight.analysis.domain.FinancialChangeRow;
import com.dartinsight.analysis.repository.AnalysisRepository;
import com.dartinsight.analysis.service.AnalysisRunner;
import com.dartinsight.common.config.ClockConfig;
import com.dartinsight.company.service.CompanyImportService;
import com.dartinsight.comparison.domain.AmountBasis;
import com.dartinsight.comparison.domain.ComparisonBasis;
import com.dartinsight.dart.dto.CorpCodeEntry;
import com.dartinsight.dart.client.FakeOpenDartServer;
import com.dartinsight.dart.client.FakeOpenDartServer.Response;
import com.dartinsight.dart.client.FinancialJson;
import com.dartinsight.financial.domain.FsDiv;
import com.dartinsight.report.domain.Correction;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.service.ReportNameParser.ParsedReportName;
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
                .andExpect(jsonPath("$.completedAt").isNotEmpty());
        mockMvc.perform(get("/api/analyses/{id}/financial-changes", id).param("sjDiv", "IS"))
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].previousAmount").value(55))
                .andExpect(jsonPath("$.items[0].currentAmount").value(70))
                .andExpect(jsonPath("$.items[0].changeAmount").value(15));
        assertThat(analysisRepository.findById(id).orElseThrow().getRequestTraceId())
                .isEqualTo("trace-analysis-1");
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
    void unknownAnalysisAndInvalidRequest() throws Exception {
        mockMvc.perform(get("/api/analyses/{id}", 999_999))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ANALYSIS_NOT_FOUND"));
        mockMvc.perform(post("/api/analyses").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors", hasSize(4)));
    }

    @Test
    void verifyRejectsValuesWithoutMatchingEvidence() {
        Analysis analysis = Analysis.request("00000001", CUR, PREV, ComparisonBasis.YOY, null, NOW);
        FinancialChangeRow ok = new FinancialChangeRow("BS", FsDiv.CFS, "k", "자산", 0, AmountBasis.POINT, 1L, 2L,
                1L, null, CalcStatus.OK, "KRW", new Evidence(PREV, "BS", "k", "자산", null),
                new Evidence(CUR, "BS", "k", "자산", null));
        FinancialChangeRow wrongReport = new FinancialChangeRow("BS", FsDiv.CFS, "k", "자산", 0, AmountBasis.POINT,
                1L, 2L, 1L, null, CalcStatus.OK, "KRW", new Evidence("20990101000001", "BS", "k", "자산", null),
                new Evidence(CUR, "BS", "k", "자산", null));
        FinancialChangeRow wrongMath = new FinancialChangeRow("BS", FsDiv.CFS, "k", "자산", 0, AmountBasis.POINT,
                1L, 2L, 5L, null, CalcStatus.OK, "KRW", new Evidence(PREV, "BS", "k", "자산", null),
                new Evidence(CUR, "BS", "k", "자산", null));

        assertThat(AnalysisRunner.verify(analysis, List.of(ok))).isNull();
        assertThat(AnalysisRunner.verify(analysis, List.of(ok, wrongReport))).contains("이전 값의 근거");
        assertThat(AnalysisRunner.verify(analysis, List.of(wrongMath))).contains("증감액");
        FinancialChangeRow differentAccounts = new FinancialChangeRow("BS", FsDiv.CFS, "k", "자산", 0,
                AmountBasis.POINT, 1L, 2L, 1L, null, CalcStatus.OK, "KRW", new Evidence(PREV, "BS", "a", "자산", null),
                new Evidence(CUR, "BS", "b", "자산", null));
        assertThat(AnalysisRunner.verify(analysis, List.of(differentAccounts))).contains("다른 계정");
    }
}
