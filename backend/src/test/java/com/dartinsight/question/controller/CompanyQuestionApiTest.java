package com.dartinsight.question.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dartinsight.aiserver.client.FakeAiServer;
import com.dartinsight.aiserver.client.FakeAiServer.Reply;
import com.dartinsight.company.domain.Company;
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
import com.dartinsight.support.TestData;
import com.dartinsight.support.TestDocuments;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
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
import tools.jackson.databind.json.JsonMapper;

/** 사업보고서에 근거해 묻기(1.2, FS-53, ADR-0029): POST·GET /api/companies/{corpCode}/questions */
@SpringBootTest
@AutoConfigureMockMvc
class CompanyQuestionApiTest {

    static final FakeOpenDartServer DART = startDart();
    static final FakeAiServer AI = new FakeAiServer();
    static final String CORP = "00000001";
    static final String ANNUAL = "20260310000001";
    static final String HALF = "20260814000001";
    static final String ANSWERS = "/internal/answers";
    static final String PARSER = "/internal/documents/parser";
    static final String DOCUMENT = "/api/document.xml";
    static final String PRODUCTS = "당사의 주요 제품은 스마트폰과 메모리 반도체입니다.";

    @DynamicPropertySource
    static void servers(DynamicPropertyRegistry registry) {
        registry.add("app.opendart.base-url", DART::baseUrl);
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
    private JsonMapper jsonMapper;

    @Autowired
    private Clock clock;

    private LocalDateTime now;

    @BeforeEach
    void setUp() {
        TestData.clearAll(jdbcTemplate);
        TestDocuments.clearCache();
        AI.clear();
        now = LocalDateTime.now(clock).truncatedTo(ChronoUnit.MICROS);
        companyImportService.save(List.of(new CorpCodeEntry(CORP, "예시전자", null, "900001", LocalDate.of(2026, 1, 1))));
        Company company = companyRepository.findByCorpCode(CORP).orElseThrow();
        company.markReportsFetched(now);
        companyRepository.save(company);
        AI.on(PARSER, Reply.ok("{\"parserVersion\":\"dart-xml-1\"}"));
        DART.on(DOCUMENT, Response.zip(TestDocuments.zip(ANNUAL)));
    }

    private void report(String rceptNo, ReportType type, String name, LocalDate periodEnd) {
        reportRepository.save(Report.create(rceptNo, CORP, name,
                new ParsedReportName(type, periodEnd.getYear(), periodEnd, Correction.ORIGINAL),
                periodEnd.plusMonths(2), null, "예시전자", now));
    }

    /** 사업보고서와 그 구조화 결과(주요 제품·위험 문단) */
    private void annualReport() {
        report(ANNUAL, ReportType.ANNUAL, "사업보고서 (2025.12)", LocalDate.of(2025, 12, 31));
        AI.on("/internal/documents/" + ANNUAL + "/structure", Reply.ok("""
                {"rceptNo":"%1$s","parserVersion":"dart-xml-1","status":"STRUCTURED","failureCode":null,
                 "failureMessage":null,"mainFile":"%1$s.xml","encoding":"utf-8","attachments":[],"warnings":[],
                 "counts":{"cells":0,"sourceCells":0},
                 "sections":[
                  {"sectionNo":1,"parentNo":null,"level":1,"title":"II. 사업의 내용","cover":false,
                   "blocks":[{"blockNo":1,"type":"PARAGRAPH","text":"가. 개요"}]},
                  {"sectionNo":2,"parentNo":1,"level":2,"title":"2. 주요 제품 및 서비스","cover":false,
                   "blocks":[{"blockNo":2,"type":"PARAGRAPH","text":"%2$s"},
                             {"blockNo":3,"type":"TABLE","text":"제품 | 비중\\n스마트폰 | 58.1%%"}]},
                  {"sectionNo":3,"parentNo":1,"level":2,"title":"5. 위험관리 및 파생거래","cover":false,
                   "blocks":[{"blockNo":4,"type":"PARAGRAPH","text":"환율 변동 위험이 있습니다."}]}
                 ]}
                """.formatted(ANNUAL, PRODUCTS)));
    }

    private static String answered(String answer, String... evidenceIds) {
        String ids = evidenceIds.length == 0 ? "" : "\"" + String.join("\",\"", evidenceIds) + "\"";
        return """
                {"promptVersion":"answer-2","expressionRulesVersion":"expr-1","model":"fake-model",
                 "generatedAt":"2026-10-26T10:12:03","status":"ANSWERED","answer":"%s",
                 "evidenceIds":[%s],"factRefs":[],"reviewReason":null,"blockedRules":[],
                 "calls":[{"task":"answer","provider":"fake","model":"fake-model","promptVersion":"answer-2",
                  "calledAt":"2026-10-26T10:12:02","traceId":"trace-c1","inputTokens":900,"outputTokens":120,
                  "latencyMs":800,"attempt":1,"outcome":"OK","error":null}]}
                """.formatted(answer, ids);
    }

    private static String withoutLlm(String status) {
        return """
                {"promptVersion":"answer-2","expressionRulesVersion":"expr-1","model":null,"generatedAt":null,
                 "status":"%s","answer":null,"evidenceIds":[],"factRefs":[],"reviewReason":null,
                 "blockedRules":[],"calls":[]}
                """.formatted(status);
    }

    private ResultActions ask(String question) throws Exception {
        String body = question == null ? "{}" : jsonMapper.writeValueAsString(Map.of("question", question));
        return mockMvc.perform(post("/api/companies/{corpCode}/questions", CORP)
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private int rows(String table) {
        return jdbcTemplate.queryForObject("SELECT COUNT(*) FROM " + table, Integer.class);
    }

    @Test
    @DisplayName("최신 사업보고서 문단에서 후보를 찾아 묻고, 답의 근거를 [1]과 원문 위치로 돌려준다")
    void answersWithCitationsFromLatestAnnualReport() throws Exception {
        annualReport();
        AI.on(ANSWERS, Reply.ok(answered("회사는 스마트폰과 메모리 반도체를 주요 제품으로 밝혔어요[" + ANNUAL + "#B2].",
                ANNUAL + "#B2")));

        ask("  주요 제품은 무엇인가요? ")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.questionId").isNumber())
                .andExpect(jsonPath("$.question").value("주요 제품은 무엇인가요?"))
                .andExpect(jsonPath("$.status").value("ANSWERED"))
                .andExpect(jsonPath("$.answer").value("회사는 스마트폰과 메모리 반도체를 주요 제품으로 밝혔어요[1]."))
                .andExpect(jsonPath("$.message").doesNotExist())
                .andExpect(jsonPath("$.citations", hasSize(1)))
                .andExpect(jsonPath("$.citations[0].no").value(1))
                .andExpect(jsonPath("$.citations[0].evidenceId").value(ANNUAL + "#B2"))
                .andExpect(jsonPath("$.citations[0].rceptNo").value(ANNUAL))
                .andExpect(jsonPath("$.citations[0].sectionNo").value(2))
                .andExpect(jsonPath("$.citations[0].blockNo").value(2))
                .andExpect(jsonPath("$.citations[0].sectionPath").value("II. 사업의 내용 > 2. 주요 제품 및 서비스"))
                .andExpect(jsonPath("$.citations[0].quote").value(PRODUCTS))
                .andExpect(jsonPath("$.report.rceptNo").value(ANNUAL))
                .andExpect(jsonPath("$.report.reportName").value("사업보고서 (2025.12)"))
                .andExpect(jsonPath("$.report.dartUrl").value("https://dart.fss.or.kr/dsaf001/main.do?rcpNo=" + ANNUAL))
                .andExpect(jsonPath("$.aiGenerated").value(true))
                .andExpect(jsonPath("$.ai.model").value("fake-model"))
                .andExpect(jsonPath("$.ai.promptVersion").value("answer-2"))
                .andExpect(jsonPath("$.ai.generatedAt").value("2026-10-26T10:12:03"))
                .andExpect(jsonPath("$.createdAt").isNotEmpty());

        List<FakeAiServer.Request> requests = AI.requests(ANSWERS);
        assertThat(requests).hasSize(1);
        String body = requests.getFirst().bodyText();
        assertThat(body).contains("\"companyName\":\"예시전자\"", "\"previousReport\":null",
                "\"currentReport\":\"사업보고서 (2025.12)\"", "\"facts\":[]",
                "\"evidenceId\":\"" + ANNUAL + "#B2\",\"side\":\"current\"");
        // 표(B3)와 관계없는 문단(B4)은 후보가 아니다
        assertThat(body).doesNotContain(ANNUAL + "#B3", ANNUAL + "#B4");
        assertThat(requests.getFirst().traceId()).isNotBlank();

        Map<String, Object> call = jdbcTemplate.queryForMap(
                "SELECT analysis_id, company_briefing_id, company_question_id, task FROM llm_call");
        assertThat(call.get("analysis_id")).isNull();
        assertThat(call.get("company_briefing_id")).isNull();
        assertThat(call.get("company_question_id")).isNotNull();
        assertThat(call.get("task")).isEqualTo("answer");
        assertThat(jdbcTemplate.queryForObject("SELECT evidence_ids FROM company_question", String.class))
                .isEqualTo(ANNUAL + "#B2");
    }

    @Test
    @DisplayName("기업 질문도 AI 사용 현황의 질문 상태별 수와 작업별 LLM 호출에 잡힌다")
    void companyQuestionIsCountedInAiUsage() throws Exception {
        annualReport();
        AI.on(ANSWERS, Reply.ok(answered("주요 제품을 밝혔어요[" + ANNUAL + "#B2].", ANNUAL + "#B2")));
        ask("주요 제품은 무엇인가요?").andExpect(status().isOk());

        mockMvc.perform(get("/api/system/ai-usage").param("days", "7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.questions.byStatus.ANSWERED").value(1))
                .andExpect(jsonPath("$.llmCalls.byTask[0].task").value("answer"))
                .andExpect(jsonPath("$.llmCalls.byTask[0].calls").value(1));
    }

    @Test
    @DisplayName("후보가 없어도 AI 서버에 물어 투자 판단 질문은 OUT_OF_SCOPE로 안내하고 LLM 호출 기록은 없다")
    void investmentQuestionIsOutOfScope() throws Exception {
        annualReport();
        AI.on(ANSWERS, Reply.ok(withoutLlm("OUT_OF_SCOPE")));

        ask("지금 사야 하나요?")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OUT_OF_SCOPE"))
                .andExpect(jsonPath("$.answer").doesNotExist())
                .andExpect(jsonPath("$.message").value(
                        "투자 판단·주가 예측을 돕는 질문에는 답하지 않아요. 공시에 적힌 사실을 물어봐 주세요."))
                .andExpect(jsonPath("$.citations", hasSize(0)))
                .andExpect(jsonPath("$.aiGenerated").value(false))
                .andExpect(jsonPath("$.ai").doesNotExist());
        assertThat(AI.requests(ANSWERS).getFirst().bodyText()).contains("\"sources\":[]");
        assertThat(rows("company_question")).isEqualTo(1);
        assertThat(rows("llm_call")).isZero();
    }

    @Test
    @DisplayName("관련 문단이 없으면 NOT_FOUND로 사업보고서 기준 안내를 저장한다")
    void questionWithoutSourcesIsNotFound() throws Exception {
        annualReport();
        AI.on(ANSWERS, Reply.ok(withoutLlm("NOT_FOUND")));

        ask("배당 정책은 어떻게 되나요?")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NOT_FOUND"))
                .andExpect(jsonPath("$.answer").doesNotExist())
                .andExpect(jsonPath("$.message").value("사업보고서에서 질문과 관련된 문단을 찾지 못했어요. "
                        + "다른 말로 물어보거나 원문에서 직접 확인해 주세요."))
                .andExpect(jsonPath("$.report.rceptNo").value(ANNUAL))
                .andExpect(jsonPath("$.aiGenerated").value(false));
        assertThat(AI.requests(ANSWERS).getFirst().bodyText()).contains("\"sources\":[]");
        assertThat(rows("company_question")).isEqualTo(1);
    }

    @Test
    @DisplayName("보낸 적 없는 근거 ID를 인용한 답은 쓰지 않고 REVIEW_NEEDED")
    void answerCitingUnknownBlockIsReviewNeeded() throws Exception {
        annualReport();
        AI.on(ANSWERS, Reply.ok(answered("주요 제품을 밝혔어요[" + ANNUAL + "#B4].", ANNUAL + "#B4")));

        ask("주요 제품은 무엇인가요?")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REVIEW_NEEDED"))
                .andExpect(jsonPath("$.answer").doesNotExist())
                .andExpect(jsonPath("$.citations", hasSize(0)))
                .andExpect(jsonPath("$.aiGenerated").value(true))
                .andExpect(jsonPath("$.ai.model").value("fake-model"));
        assertThat(jdbcTemplate.queryForObject("SELECT review_reason FROM company_question", String.class))
                .isEqualTo("답의 근거 표시가 보낸 원문 위치·사실이 아니라 쓰지 않았어요.");
        assertThat(rows("llm_call")).isEqualTo(1);
    }

    @Test
    @DisplayName("질문이 비었거나 2자 미만·200자 초과면 400 errors[question]이고 AI 서버를 부르지 않는다")
    void rejectsQuestionsOfWrongLength() throws Exception {
        annualReport();
        for (String question : new String[] {null, "   ", " 가 ", "가".repeat(201)}) {
            ask(question)
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"))
                    .andExpect(jsonPath("$.errors[0].field").value("question"));
        }
        assertThat(AI.requests(ANSWERS)).isEmpty();
        assertThat(rows("company_question")).isZero();
    }

    @Test
    @DisplayName("기록은 지금 대상 보고서의 질문만 최신 순이고, 저장된 근거 ID로 인용을 다시 만든다")
    void historyIsNewestFirstForCurrentSourceReport() throws Exception {
        annualReport();
        AI.on(ANSWERS, Reply.ok(answered("주요 제품을 밝혔어요[" + ANNUAL + "#B2].", ANNUAL + "#B2")));
        ask("주요 제품은 무엇인가요?").andExpect(status().isOk());
        AI.on(ANSWERS, Reply.ok(withoutLlm("NOT_FOUND")));
        ask("배당 정책은 어떻게 되나요?").andExpect(status().isOk());

        mockMvc.perform(get("/api/companies/{corpCode}/questions", CORP))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.report.rceptNo").value(ANNUAL))
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.items[0].question").value("배당 정책은 어떻게 되나요?"))
                .andExpect(jsonPath("$.items[0].status").value("NOT_FOUND"))
                .andExpect(jsonPath("$.items[1].status").value("ANSWERED"))
                .andExpect(jsonPath("$.items[1].answer").value("주요 제품을 밝혔어요[1]."))
                .andExpect(jsonPath("$.items[1].citations[0].evidenceId").value(ANNUAL + "#B2"))
                .andExpect(jsonPath("$.items[1].citations[0].sectionNo").value(2))
                .andExpect(jsonPath("$.items[1].citations[0].sectionPath")
                        .value("II. 사업의 내용 > 2. 주요 제품 및 서비스"))
                .andExpect(jsonPath("$.items[1].citations[0].quote").value(PRODUCTS))
                .andExpect(jsonPath("$.items[1].ai.promptVersion").value("answer-2"));
    }

    @Test
    @DisplayName("반기보고서만 있으면 그 보고서에 묻는다")
    void latestPeriodicReportIsUsedWithoutAnnualReport() throws Exception {
        report(HALF, ReportType.HALF, "반기보고서 (2026.06)", LocalDate.of(2026, 6, 30));
        DART.on(DOCUMENT, Response.zip(TestDocuments.zip(HALF)));
        AI.on("/internal/documents/" + HALF + "/structure", Reply.ok("""
                {"rceptNo":"%1$s","parserVersion":"dart-xml-1","status":"STRUCTURED","failureCode":null,
                 "failureMessage":null,"mainFile":"%1$s.xml","encoding":"utf-8","attachments":[],"warnings":[],
                 "counts":{"cells":0,"sourceCells":0},
                 "sections":[{"sectionNo":1,"parentNo":null,"level":1,"title":"II. 사업의 내용","cover":false,
                   "blocks":[{"blockNo":1,"type":"PARAGRAPH","text":"%2$s"}]}]}
                """.formatted(HALF, PRODUCTS)));
        AI.on(ANSWERS, Reply.ok(answered("주요 제품을 밝혔어요[" + HALF + "#B1].", HALF + "#B1")));

        ask("주요 제품은 무엇인가요?")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ANSWERED"))
                .andExpect(jsonPath("$.report.rceptNo").value(HALF));
    }

    @Test
    @DisplayName("정기보고서가 없으면 묻기는 404 REPORT_NOT_FOUND, 기록은 빈 목록")
    void companyWithoutReportsHasNothingToAsk() throws Exception {
        ask("주요 제품은 무엇인가요?")
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("REPORT_NOT_FOUND"));
        mockMvc.perform(get("/api/companies/{corpCode}/questions", CORP))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.report").doesNotExist())
                .andExpect(jsonPath("$.items", hasSize(0)));
        assertThat(AI.requests(ANSWERS)).isEmpty();
    }

    @Test
    @DisplayName("AI 서버를 쓸 수 없으면 503 AI_SERVER_UNAVAILABLE이고 저장하지 않는다")
    void aiServerFailureIsNotSaved() throws Exception {
        annualReport();
        AI.on(ANSWERS, Reply.error(503, "AI_LLM_UNAVAILABLE", "LLM 없음"));

        ask("주요 제품은 무엇인가요?")
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("AI_SERVER_UNAVAILABLE"));
        assertThat(rows("company_question")).isZero();
    }

    @Test
    @DisplayName("없는 기업은 404 COMPANY_NOT_FOUND")
    void unknownCompanyIsNotFound() throws Exception {
        mockMvc.perform(post("/api/companies/{corpCode}/questions", "99999999")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"question\":\"주요 제품은?\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COMPANY_NOT_FOUND"));
        mockMvc.perform(get("/api/companies/{corpCode}/questions", "99999999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COMPANY_NOT_FOUND"));
    }
}
