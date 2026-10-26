package com.dartinsight.system.controller;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.repository.AnalysisRepository;
import com.dartinsight.company.service.CompanyImportService;
import com.dartinsight.comparison.domain.ComparisonBasis;
import com.dartinsight.dart.domain.CorpCodeEntry;
import com.dartinsight.report.domain.Correction;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.domain.ReportNameParser.ParsedReportName;
import com.dartinsight.report.domain.ReportType;
import com.dartinsight.report.repository.ReportRepository;
import com.dartinsight.support.TestData;
import java.sql.Timestamp;
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
import org.springframework.test.web.servlet.MockMvc;

/** AI 사용 현황(0.7, FS-15): GET /api/system/ai-usage */
@SpringBootTest
@AutoConfigureMockMvc
class AiUsageApiTest {

    static final String CUR = "20260814000001";
    static final String PREV = "20250814000001";
    static final String SECRET_QUESTION = "비밀 질문 본문입니다";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AnalysisRepository analysisRepository;

    @Autowired
    private CompanyImportService companyImportService;

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
        now = LocalDateTime.now(clock);
    }

    @Test
    @DisplayName("기록이 없으면 모든 수가 0이고 도움됨 비율은 null, 기본 기간은 30일")
    void returnsZerosAndNullRateForEmptyDatabase() throws Exception {
        LocalDate today = now.toLocalDate();
        mockMvc.perform(get("/api/system/ai-usage"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.days").value(30))
                .andExpect(jsonPath("$.from").value(today.minusDays(29).toString()))
                .andExpect(jsonPath("$.to").value(today.toString()))
                .andExpect(jsonPath("$.questions.total").value(0))
                .andExpect(jsonPath("$.questions.byStatus.ANSWERED").value(0))
                .andExpect(jsonPath("$.questions.byStatus.NOT_FOUND").value(0))
                .andExpect(jsonPath("$.questions.byStatus.OUT_OF_SCOPE").value(0))
                .andExpect(jsonPath("$.questions.byStatus.REVIEW_NEEDED").value(0))
                .andExpect(jsonPath("$.feedback.rated").value(0))
                .andExpect(jsonPath("$.feedback.helpful").value(0))
                .andExpect(jsonPath("$.feedback.notHelpful").value(0))
                .andExpect(jsonPath("$.feedback.helpfulRate").isEmpty())
                .andExpect(jsonPath("$.feedback.reasons.WRONG_SOURCE").value(0))
                .andExpect(jsonPath("$.feedback.reasons.OTHER").value(0))
                .andExpect(jsonPath("$.explanations.total").value(0))
                .andExpect(jsonPath("$.explanations.byStatus.OK").value(0))
                .andExpect(jsonPath("$.explanations.byStatus.NO_SOURCE").value(0))
                .andExpect(jsonPath("$.llmCalls.total").value(0))
                .andExpect(jsonPath("$.llmCalls.byOutcome.OK").value(0))
                .andExpect(jsonPath("$.llmCalls.byOutcome.INVALID_OUTPUT").value(0))
                .andExpect(jsonPath("$.llmCalls.byOutcome.TRANSIENT_ERROR").value(0))
                .andExpect(jsonPath("$.llmCalls.byOutcome.ERROR").value(0))
                .andExpect(jsonPath("$.llmCalls.byTask", hasSize(0)))
                .andExpect(jsonPath("$.llmCalls.byModel", hasSize(0)))
                .andExpect(jsonPath("$.llmCalls.perUnit.analysis.count").value(0))
                .andExpect(jsonPath("$.llmCalls.perUnit.analysis.avgInputTokens").isEmpty())
                .andExpect(jsonPath("$.llmCalls.perUnit.analysis.avgCostUsd").isEmpty())
                .andExpect(jsonPath("$.llmCalls.perUnit.briefing.count").value(0))
                .andExpect(jsonPath("$.llmCalls.perUnit.briefing.avgOutputTokens").isEmpty());
    }

    @Test
    @DisplayName("가짜·실제 제공자를 모델별로 따로 세고, 가격 설정이 있는 모델만 추정 비용을 계산한다")
    void separatesProvidersAndEstimatesCostOnlyForPricedModels() throws Exception {
        long analysisId = seedAnalysis();
        LocalDateTime recent = now.minusDays(1);
        call(analysisId, null, "fake", "fake-model", "summary", "OK", recent, 100, 10);
        call(analysisId, null, "openai", "gpt-6.1-sol", "answer", "OK", recent, 9000, 1200);
        call(analysisId, null, "openai", "gpt-6.1-sol", "summary", "OK", recent, 1000, null);
        call(analysisId, null, "openai", "gpt-6.1-sol", "summary", "OK", now.minusDays(40), 50000, 5000);
        call(analysisId, null, "openai", "gpt-unpriced", "answer", "OK", recent, 10, 10);

        // gpt-6.1-sol(입력 $2, 출력 $10 / 1M): (10000 × 2 + 1200 × 10) ÷ 1,000,000 = 0.032
        mockMvc.perform(get("/api/system/ai-usage"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.llmCalls.total").value(4))
                .andExpect(jsonPath("$.llmCalls.byModel", hasSize(3)))
                .andExpect(jsonPath("$.llmCalls.byModel[0].provider").value("fake"))
                .andExpect(jsonPath("$.llmCalls.byModel[0].model").value("fake-model"))
                .andExpect(jsonPath("$.llmCalls.byModel[0].calls").value(1))
                .andExpect(jsonPath("$.llmCalls.byModel[0].inputTokens").value(100))
                .andExpect(jsonPath("$.llmCalls.byModel[0].estimatedCostUsd").isEmpty())
                .andExpect(jsonPath("$.llmCalls.byModel[0].byTask", hasSize(1)))
                .andExpect(jsonPath("$.llmCalls.byModel[1].provider").value("openai"))
                .andExpect(jsonPath("$.llmCalls.byModel[1].model").value("gpt-6.1-sol"))
                .andExpect(jsonPath("$.llmCalls.byModel[1].calls").value(2))
                .andExpect(jsonPath("$.llmCalls.byModel[1].inputTokens").value(10000))
                .andExpect(jsonPath("$.llmCalls.byModel[1].outputTokens").value(1200))
                .andExpect(jsonPath("$.llmCalls.byModel[1].estimatedCostUsd").value(0.032))
                .andExpect(jsonPath("$.llmCalls.byModel[1].byTask", hasSize(2)))
                .andExpect(jsonPath("$.llmCalls.byModel[1].byTask[0].task").value("answer"))
                .andExpect(jsonPath("$.llmCalls.byModel[1].byTask[0].calls").value(1))
                .andExpect(jsonPath("$.llmCalls.byModel[1].byTask[1].task").value("summary"))
                .andExpect(jsonPath("$.llmCalls.byModel[1].byTask[1].inputTokens").value(1000))
                .andExpect(jsonPath("$.llmCalls.byModel[1].byTask[1].outputTokens").isEmpty())
                .andExpect(jsonPath("$.llmCalls.byModel[2].model").value("gpt-unpriced"))
                .andExpect(jsonPath("$.llmCalls.byModel[2].estimatedCostUsd").isEmpty())
                .andExpect(jsonPath("$.llmCalls.byTask", hasSize(2)))
                .andExpect(jsonPath("$.llmCalls.byTask[1].task").value("summary"))
                .andExpect(jsonPath("$.llmCalls.byTask[1].calls").value(2));
    }

    @Test
    @DisplayName("분석·브리핑 1건당 평균 토큰·비용은 기간 안에 호출이 있는 단위의 합을 단위 수로 나눈다")
    void averagesTokensAndCostPerAnalysisAndBriefing() throws Exception {
        long first = seedAnalysis();
        long second = analysisRepository.save(Analysis.request("00000001", CUR, PREV, ComparisonBasis.YOY, null, now))
                .getId();
        long pricedBriefing = briefing("bp-1");
        long mixedBriefing = briefing("bp-2");
        LocalDateTime recent = now.minusDays(1);
        call(first, null, "openai", "gpt-6.1-sol", "summary", "OK", recent, 30000, 2000);
        call(first, null, "openai", "gpt-6.1-sol", "answer", "OK", recent, 10000, 1000);
        call(second, null, "openai", "gpt-6.1-sol", "summary", "OK", recent, 20000, 1001);
        call(second, null, "openai", "gpt-6.1-sol", "summary", "OK", now.minusDays(40), 99999, 99999);
        call(null, pricedBriefing, "openai", "gpt-6.1-sol", "briefing", "OK", recent, 5000, 500);
        call(null, mixedBriefing, "fake", "fake-model", "briefing", "OK", recent, 1000, 100);

        // 분석: 입력 (40000 + 20000) ÷ 2 = 30000, 출력 (3000 + 1001) ÷ 2 = 2000.5 → 2001,
        // 비용 (60000 × 2 + 4001 × 10) ÷ 1,000,000 ÷ 2 = 0.080005 → 0.08
        // 브리핑: 가짜 제공자 호출이 섞여 비용 평균은 null, 토큰은 (5000 + 1000) ÷ 2 = 3000
        mockMvc.perform(get("/api/system/ai-usage").param("days", "7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.llmCalls.perUnit.analysis.count").value(2))
                .andExpect(jsonPath("$.llmCalls.perUnit.analysis.avgInputTokens").value(30000))
                .andExpect(jsonPath("$.llmCalls.perUnit.analysis.avgOutputTokens").value(2001))
                .andExpect(jsonPath("$.llmCalls.perUnit.analysis.avgCostUsd").value(0.08))
                .andExpect(jsonPath("$.llmCalls.perUnit.briefing.count").value(2))
                .andExpect(jsonPath("$.llmCalls.perUnit.briefing.avgInputTokens").value(3000))
                .andExpect(jsonPath("$.llmCalls.perUnit.briefing.avgOutputTokens").value(300))
                .andExpect(jsonPath("$.llmCalls.perUnit.briefing.avgCostUsd").isEmpty());

        jdbcTemplate.update("DELETE FROM llm_call WHERE company_briefing_id = ?", mixedBriefing);
        // 가격이 있는 모델만 남으면 계산값: (5000 × 2 + 500 × 10) ÷ 1,000,000 = 0.015
        mockMvc.perform(get("/api/system/ai-usage").param("days", "7"))
                .andExpect(jsonPath("$.llmCalls.perUnit.briefing.count").value(1))
                .andExpect(jsonPath("$.llmCalls.perUnit.briefing.avgCostUsd").value(0.015));
    }

    @Test
    @DisplayName("기간 안의 질문·평가·풀이·LLM 호출을 세고, 질문 본문은 돌려주지 않는다")
    void countsRowsInsideThirtyDayWindow() throws Exception {
        long analysisId = seedAnalysis();
        LocalDateTime recent = now.minusDays(1);
        LocalDateTime older = now.minusDays(10);
        LocalDateTime outside = now.minusDays(40);
        question(analysisId, "ANSWERED", recent, true, null);
        question(analysisId, "ANSWERED", recent, true, null);
        question(analysisId, "ANSWERED", older, false, "WRONG_SOURCE");
        question(analysisId, "ANSWERED", older, null, null);
        question(analysisId, "NOT_FOUND", recent, null, null);
        question(analysisId, "OUT_OF_SCOPE", older, null, null);
        question(analysisId, "ANSWERED", outside, false, "OTHER");
        explanation(analysisId, 1, "OK", recent);
        explanation(analysisId, 2, "REVIEW_NEEDED", older);
        explanation(analysisId, 3, "NO_SOURCE", outside);
        call(analysisId, "answer", "OK", recent, 900, 120);
        call(analysisId, "answer", "INVALID_OUTPUT", older, 800, null);
        call(analysisId, "summary", "OK", older, null, null);
        call(analysisId, "summary", "ERROR", outside, 1000, 100);

        mockMvc.perform(get("/api/system/ai-usage").param("days", "30"))
                .andExpect(status().isOk())
                .andExpect(content().string(not(containsString(SECRET_QUESTION))))
                .andExpect(jsonPath("$.questions.total").value(6))
                .andExpect(jsonPath("$.questions.byStatus.ANSWERED").value(4))
                .andExpect(jsonPath("$.questions.byStatus.NOT_FOUND").value(1))
                .andExpect(jsonPath("$.questions.byStatus.OUT_OF_SCOPE").value(1))
                .andExpect(jsonPath("$.questions.byStatus.REVIEW_NEEDED").value(0))
                .andExpect(jsonPath("$.feedback.rated").value(3))
                .andExpect(jsonPath("$.feedback.helpful").value(2))
                .andExpect(jsonPath("$.feedback.notHelpful").value(1))
                .andExpect(jsonPath("$.feedback.helpfulRate").value(0.6667))
                .andExpect(jsonPath("$.feedback.reasons.WRONG_SOURCE").value(1))
                .andExpect(jsonPath("$.feedback.reasons.OTHER").value(0))
                .andExpect(jsonPath("$.explanations.total").value(2))
                .andExpect(jsonPath("$.explanations.byStatus.OK").value(1))
                .andExpect(jsonPath("$.explanations.byStatus.REVIEW_NEEDED").value(1))
                .andExpect(jsonPath("$.explanations.byStatus.NO_SOURCE").value(0))
                .andExpect(jsonPath("$.llmCalls.total").value(3))
                .andExpect(jsonPath("$.llmCalls.byOutcome.OK").value(2))
                .andExpect(jsonPath("$.llmCalls.byOutcome.INVALID_OUTPUT").value(1))
                .andExpect(jsonPath("$.llmCalls.byOutcome.ERROR").value(0))
                .andExpect(jsonPath("$.llmCalls.byTask", hasSize(2)))
                .andExpect(jsonPath("$.llmCalls.byTask[0].task").value("answer"))
                .andExpect(jsonPath("$.llmCalls.byTask[0].calls").value(2))
                .andExpect(jsonPath("$.llmCalls.byTask[0].inputTokens").value(1700))
                .andExpect(jsonPath("$.llmCalls.byTask[0].outputTokens").value(120))
                .andExpect(jsonPath("$.llmCalls.byTask[1].task").value("summary"))
                .andExpect(jsonPath("$.llmCalls.byTask[1].calls").value(1))
                .andExpect(jsonPath("$.llmCalls.byTask[1].inputTokens").isEmpty())
                .andExpect(jsonPath("$.llmCalls.byTask[1].outputTokens").isEmpty());

        mockMvc.perform(get("/api/system/ai-usage").param("days", "7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.days").value(7))
                .andExpect(jsonPath("$.from").value(now.toLocalDate().minusDays(6).toString()))
                .andExpect(jsonPath("$.questions.total").value(3))
                .andExpect(jsonPath("$.questions.byStatus.ANSWERED").value(2))
                .andExpect(jsonPath("$.feedback.rated").value(2))
                .andExpect(jsonPath("$.feedback.helpfulRate").value(1.0))
                .andExpect(jsonPath("$.feedback.reasons.WRONG_SOURCE").value(0))
                .andExpect(jsonPath("$.explanations.total").value(1))
                .andExpect(jsonPath("$.llmCalls.total").value(1))
                .andExpect(jsonPath("$.llmCalls.byTask", hasSize(1)))
                .andExpect(jsonPath("$.llmCalls.byTask[0].task").value("answer"));
    }

    @Test
    @DisplayName("days가 7·30이 아니거나 숫자가 아니면 400 errors[days]")
    void rejectsDaysOtherThanSevenOrThirty() throws Exception {
        for (String days : List.of("0", "1", "14", "31", "-7", "abc")) {
            mockMvc.perform(get("/api/system/ai-usage").param("days", days))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"))
                    .andExpect(jsonPath("$.errors[0].field").value("days"));
        }
    }

    private long seedAnalysis() {
        companyImportService.save(List.of(
                new CorpCodeEntry("00000001", "예시전자", null, "900001", LocalDate.of(2026, 1, 1))));
        for (int year : new int[] {2025, 2026}) {
            reportRepository.save(Report.create(year == 2026 ? CUR : PREV, "00000001", "반기보고서 (" + year + ".06)",
                    new ParsedReportName(ReportType.HALF, year, LocalDate.of(year, 6, 30), Correction.ORIGINAL),
                    LocalDate.of(year, 8, 14), null, "예시전자", now));
        }
        return analysisRepository.save(Analysis.request("00000001", CUR, PREV, ComparisonBasis.YOY, null, now))
                .getId();
    }

    private void question(long analysisId, String status, LocalDateTime createdAt, Boolean helpful, String reason) {
        jdbcTemplate.update("INSERT INTO analysis_question (analysis_id, question, status, created_at, "
                + "feedback_helpful, feedback_reason, feedback_at) VALUES (?, ?, ?, ?, ?, ?, ?)", analysisId,
                SECRET_QUESTION, status, Timestamp.valueOf(createdAt), helpful, reason,
                helpful == null ? null : Timestamp.valueOf(createdAt));
    }

    private void explanation(long analysisId, int changeNo, String status, LocalDateTime createdAt) {
        jdbcTemplate.update("INSERT INTO text_change_explanation (analysis_id, change_no, status, created_at) "
                + "VALUES (?, ?, ?, ?)", analysisId, changeNo, status, Timestamp.valueOf(createdAt));
    }

    private void call(long analysisId, String task, String outcome, LocalDateTime calledAt, Integer inputTokens,
            Integer outputTokens) {
        call(analysisId, null, "fake", "fake-model", task, outcome, calledAt, inputTokens, outputTokens);
    }

    private void call(Long analysisId, Long briefingId, String provider, String model, String task, String outcome,
            LocalDateTime calledAt, Integer inputTokens, Integer outputTokens) {
        jdbcTemplate.update("INSERT INTO llm_call (analysis_id, company_briefing_id, task, provider, model, "
                + "prompt_version, called_at, input_tokens, output_tokens, latency_ms, attempt, outcome) "
                + "VALUES (?, ?, ?, ?, ?, 'v1', ?, ?, ?, 100, 1, ?)", analysisId, briefingId, task, provider, model,
                Timestamp.valueOf(calledAt), inputTokens, outputTokens, outcome);
    }

    private long briefing(String promptVersion) {
        jdbcTemplate.update("INSERT INTO company_briefing (rcept_no, prompt_version, status, sentences, created_at) "
                + "VALUES (?, ?, 'OK', '[]', ?)", CUR, promptVersion, Timestamp.valueOf(now));
        return jdbcTemplate.queryForObject("SELECT id FROM company_briefing WHERE prompt_version = ?", Long.class,
                promptVersion);
    }
}
