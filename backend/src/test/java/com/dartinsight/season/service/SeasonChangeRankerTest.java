package com.dartinsight.season.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dartinsight.aiserver.client.FakeAiServer;
import com.dartinsight.aiserver.client.FakeAiServer.Reply;
import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.domain.TextComparison;
import com.dartinsight.analysis.domain.TextStatus;
import com.dartinsight.analysis.repository.AnalysisRepository;
import com.dartinsight.analysis.service.AnalysisResultService;
import com.dartinsight.company.domain.Company;
import com.dartinsight.comparison.domain.ComparisonBasis;
import com.dartinsight.company.repository.CompanyRepository;
import com.dartinsight.company.service.CompanyImportService;
import com.dartinsight.dart.client.FakeOpenDartServer;
import com.dartinsight.dart.client.FakeOpenDartServer.Response;
import com.dartinsight.dart.domain.CorpCodeEntry;
import com.dartinsight.report.domain.Correction;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.domain.ReportNameParser.ParsedReportName;
import com.dartinsight.report.domain.ReportType;
import com.dartinsight.report.repository.ReportRepository;
import com.dartinsight.season.domain.Season;
import com.dartinsight.support.TestData;
import com.dartinsight.support.TestDocuments;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.Clock;
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
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/** 이번 시즌 변화가 큰 기업(1.7, #420, ADR-0037): 대표 기업을 문장 비교만으로 재어 순위를 저장하고 API로 돌려준다 */
@SpringBootTest
@AutoConfigureMockMvc
class SeasonChangeRankerTest {

    static final FakeOpenDartServer DART = startDart();
    static final FakeAiServer AI = new FakeAiServer();
    static final Season SEASON = new Season(ReportType.HALF, 2026);
    /** 점수를 매기는 기업, 그 시즌 보고서가 없는 기업, 원문을 읽지 못하는 기업 */
    static final String SCORED = "00000001";
    static final String NO_REPORT = "00000002";
    static final String FAILS = "00000003";
    static final String DIFF = "/internal/text-changes";

    @DynamicPropertySource
    static void servers(DynamicPropertyRegistry registry) {
        registry.add("app.opendart.base-url", DART::baseUrl);
        registry.add("app.opendart.read-timeout", () -> "2s");
        registry.add("app.ai-server.base-url", AI::baseUrl);
    }

    private static FakeOpenDartServer startDart() {
        try {
            return new FakeOpenDartServer();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    @Autowired
    private SeasonChangeRanker ranker;

    @Autowired
    private MockMvc mvc;

    @Autowired
    private CompanyImportService companyImportService;

    @Autowired
    private CompanyRepository companyRepository;

    @Autowired
    private ReportRepository reportRepository;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private Clock clock;

    @Autowired
    private AnalysisRepository analysisRepository;

    @Autowired
    private AnalysisResultService resultService;

    @BeforeEach
    void setUp() {
        TestData.clearAll(jdbc);
        TestDocuments.clearCache();
        AI.clear();
        LocalDateTime now = LocalDateTime.now(clock);
        companyImportService.save(List.of(
                new CorpCodeEntry(SCORED, "예시전자", null, "900001", LocalDate.of(2026, 1, 1)),
                new CorpCodeEntry(NO_REPORT, "예시화학", null, "900002", LocalDate.of(2026, 1, 1)),
                new CorpCodeEntry(FAILS, "예시건설", null, "900003", LocalDate.of(2026, 1, 1))));
        for (String corpCode : List.of(SCORED, NO_REPORT, FAILS)) {
            int rank = Integer.parseInt(corpCode);
            jdbc.update("INSERT INTO featured_company (rank_no, corp_code, market_cap, base_date, fetched_at) "
                    + "VALUES (?, ?, ?, ?, ?)", rank, corpCode, 1000L - rank, LocalDate.of(2026, 10, 24), now);
            // 방금 목록을 받은 것으로 둬 정기보고서 목록을 OpenDART에서 다시 받지 않게 한다
            Company company = companyRepository.findByCorpCode(corpCode).orElseThrow();
            company.markReportsFetched(now);
            companyRepository.save(company);
        }
        half(SCORED, "20250814000001", 2025, now);
        half(SCORED, "20260814000001", 2026, now);
        half(NO_REPORT, "20250814000002", 2025, now);
        half(FAILS, "20250814000003", 2025, now);
        half(FAILS, "20260814000003", 2026, now);

        DART.on("/api/document.xml", Response.zip(TestDocuments.zip("20250814000001")));
        AI.on("/internal/documents/parser", Reply.ok("{\"parserVersion\":\"dart-xml-1\"}"));
        for (String rceptNo : List.of("20250814000001", "20260814000001")) {
            AI.on("/internal/documents/" + rceptNo + "/structure", Reply.ok(document(rceptNo)));
        }
        // 00000003의 원문은 ai-server가 읽지 못한다(등록하지 않은 경로는 404)
        AI.on(DIFF, Reply.ok("""
                {"diffVersion":"text-diff-2","priorityVersion":"priority-2","sectionCounts":{"matched":2},"changes":[
                 {"changeType":"MODIFIED","blockType":"PARAGRAPH","sectionStatus":"MATCHED",
                  "sectionTitle":"1. 사업의 개요","sectionPath":"II. 사업의 내용 > 1. 사업의 개요",
                  "previous":{"sectionNo":2,"blockNo":1},"current":{"sectionNo":2,"blockNo":1},
                  "numbersOnly":false,"similarity":0.7,"reviewReason":null,
                  "priority":{"level":"MEDIUM","score":50,"reasons":["사업의 내용 섹션 +30","수정 +10","문단 +10"]}},
                 {"changeType":"NUMERIC_UPDATE","blockType":"TABLE","sectionStatus":"MATCHED",
                  "sectionTitle":"1. 사업의 개요","sectionPath":"II. 사업의 내용 > 1. 사업의 개요",
                  "previous":{"sectionNo":2,"blockNo":2},"current":{"sectionNo":2,"blockNo":2},
                  "numbersOnly":true,"similarity":0.95,"reviewReason":null,
                  "priority":{"level":"LOW","score":20,"reasons":[]}}
                ]}
                """));
    }

    @Test
    @DisplayName("대표 기업을 문장 비교만으로 재어 순위를 저장하고, 빠진 기업은 사유별로 센다")
    void ranksFeaturedCompaniesByTextChanges() throws Exception {
        assertThat(ranker.computeIfMissing(SEASON)).isTrue();

        mvc.perform(get("/api/season-changes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.season.reportType").value("HALF"))
                .andExpect(jsonPath("$.season.fiscalYear").value(2026))
                .andExpect(jsonPath("$.season.previousFiscalYear").value(2025))
                .andExpect(jsonPath("$.seasons[0].reportType").value("HALF"))
                .andExpect(jsonPath("$.scoreVersion").value("season-1"))
                .andExpect(jsonPath("$.candidateCount").value(3))
                .andExpect(jsonPath("$.rankedCount").value(1))
                .andExpect(jsonPath("$.excluded.noReport").value(1))
                .andExpect(jsonPath("$.excluded.failed").value(1))
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].rank").value(1))
                .andExpect(jsonPath("$.items[0].corpCode").value(SCORED))
                .andExpect(jsonPath("$.items[0].corpName").value("예시전자"))
                .andExpect(jsonPath("$.items[0].previousRceptNo").value("20250814000001"))
                .andExpect(jsonPath("$.items[0].currentRceptNo").value("20260814000001"))
                // 숫자만 바뀐 표는 넣지 않는다
                .andExpect(jsonPath("$.items[0].changeCount").value(1))
                .andExpect(jsonPath("$.items[0].highlight").value("사업의 내용 수정 1곳"));
        // 점수: 50 ÷ (블록 2개 평균 ÷ 1,000) = 25,000
        assertThat(jdbc.queryForObject("SELECT score FROM season_change WHERE corp_code = ?", Double.class, SCORED))
                .isEqualTo(25000.0);
        assertThat(jdbc.queryForObject("SELECT status FROM season_change WHERE corp_code = ?", String.class, FAILS))
                .isEqualTo("FAILED");
        // 순위를 재는 동안에는 분석을 만들지 않는다. 상위 기업만 요약까지 있는 분석을 요청한다
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM analysis WHERE corp_code <> ?", Long.class, SCORED))
                .isZero();
    }

    @Test
    @DisplayName("상위 기업의 분석이 없거나 실패했거나 진행 중으로 남았으면 다시 요청해 정상 분석으로 잇는다")
    void retriesMissingOrFailedTopAnalyses() {
        ranker.computeIfMissing(SEASON);
        LocalDateTime now = LocalDateTime.now(clock);
        Analysis failed = Analysis.request(SCORED, "20260814000001", "20250814000001", ComparisonBasis.YOY, null, now);
        failed.start(now);
        failed.fail("ANALYSIS_FAILED", "실패", now);
        long failedId = analysisRepository.save(failed).getId();
        Analysis running = Analysis.request(SCORED, "20260814000001", "20250814000001", ComparisonBasis.YOY, null, now);
        running.start(now);
        long runningId = analysisRepository.save(running).getId();
        Analysis completed = Analysis.request(SCORED, "20260814000001", "20250814000001", ComparisonBasis.YOY, null,
                now);
        completed.start(now);
        long completedId = analysisRepository.save(completed).getId();
        resultService.saveAndComplete(completedId, List.of(), new TextComparison(TextStatus.COMPLETED, null, List.of()));

        // 요청에 실패해 비어 있는 경우
        jdbc.update("UPDATE season_change SET analysis_id = NULL WHERE corp_code = ?", SCORED);
        ranker.retryAnalyses(SEASON);
        assertThat(linkedAnalysis()).isEqualTo(completedId);

        // 이어 둔 분석이 실패한 경우
        jdbc.update("UPDATE season_change SET analysis_id = ? WHERE corp_code = ?", failedId, SCORED);
        ranker.retryAnalyses(SEASON);
        assertThat(linkedAnalysis()).isEqualTo(completedId);

        // 서버가 멈춰 진행 중으로 남은 분석을 이어 둔 경우
        jdbc.update("UPDATE season_change SET analysis_id = ? WHERE corp_code = ?", runningId, SCORED);
        ranker.retryAnalyses(SEASON);
        assertThat(linkedAnalysis()).isEqualTo(completedId);
    }

    private Long linkedAnalysis() {
        return jdbc.queryForObject("SELECT analysis_id FROM season_change WHERE corp_code = ?", Long.class, SCORED);
    }

    @Test
    @DisplayName("계산한 시즌은 다시 계산하지 않는다")
    void doesNotRecomputeSeason() {
        assertThat(ranker.computeIfMissing(SEASON)).isTrue();
        int calls = AI.requests(DIFF).size();

        assertThat(ranker.computeIfMissing(SEASON)).isFalse();
        assertThat(AI.requests(DIFF)).hasSize(calls);
    }

    @Test
    @DisplayName("계산한 시즌이 없으면 빈 목록이고, 계산하지 않은 시즌·짝이 없는 값은 404·400이다")
    void emptyUnknownAndInvalidSeasons() throws Exception {
        mvc.perform(get("/api/season-changes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.season").value(nullValue()))
                .andExpect(jsonPath("$.items.length()").value(0));

        ranker.computeIfMissing(SEASON);
        mvc.perform(get("/api/season-changes").param("reportType", "Q1").param("fiscalYear", "2026"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COMMON_NOT_FOUND"));
        mvc.perform(get("/api/season-changes").param("reportType", "HALF"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("fiscalYear"));
        mvc.perform(get("/api/season-changes").param("reportType", "QOQ").param("fiscalYear", "2026"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("reportType"));
    }

    /** 문단 하나, 표 하나인 구조화 결과(블록 2개) */
    private static String document(String rceptNo) {
        return """
                {"rceptNo":"%s","parserVersion":"dart-xml-1","status":"STRUCTURED","mainFile":"%s.xml",
                 "warnings":[],"counts":{"cells":4,"sourceCells":4},
                 "sections":[
                  {"sectionNo":1,"parentNo":null,"level":1,"title":"II. 사업의 내용","cover":false,"blocks":[]},
                  {"sectionNo":2,"parentNo":1,"level":2,"title":"1. 사업의 개요","cover":false,"blocks":[
                    {"blockNo":1,"type":"PARAGRAPH","text":"당사는 메모리를 만듭니다. %s"},
                    {"blockNo":2,"type":"TABLE","text":"구분 | 금액","rows":[[{"text":"구분"}]]}]}
                 ]}
                """.formatted(rceptNo, rceptNo, rceptNo);
    }

    private void half(String corpCode, String rceptNo, int year, LocalDateTime now) {
        reportRepository.save(Report.create(rceptNo, corpCode, "반기보고서 (" + year + ".06)",
                new ParsedReportName(ReportType.HALF, year, LocalDate.of(year, 6, 30), Correction.ORIGINAL),
                LocalDate.of(year, 8, 14), null, "예시", now));
    }
}
