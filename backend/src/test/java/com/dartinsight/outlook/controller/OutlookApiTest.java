package com.dartinsight.outlook.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
import com.dartinsight.outlook.domain.OutlookCategory;
import com.dartinsight.outlook.domain.OutlookStatus;
import com.dartinsight.outlook.domain.ReportOutlook;
import com.dartinsight.outlook.service.OutlookService;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/** 회사가 밝힌 전망·계획(1.9, ADR-0039): GET /api/companies/{corpCode}/outlook, 가짜 OpenDART(원문)·AI 서버 */
@SpringBootTest
@AutoConfigureMockMvc
class OutlookApiTest {

    static final FakeOpenDartServer DART = startDart();
    static final FakeAiServer AI = new FakeAiServer();
    static final String CORP = "00000001";
    static final String ANNUAL = "20260310000001";
    static final String HALF = "20260814000001";
    static final String OUTLOOKS = "/internal/outlooks";
    static final String PARSER = "/internal/documents/parser";
    static final String DOCUMENT = "/api/document.xml";
    static final String LONG = " 이 문단은 근거로 쓸 수 있을 만큼 원문에 충분히 길게 적었습니다. 마흔 자를 넘습니다.";
    static final String FACILITY = "당사는 평택 신규 라인 증설을 2026년까지 완료할 계획입니다.";
    static final String MARKET = "메모리 시장은 수요 회복으로 성장할 것으로 전망합니다.";

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
    private OutlookService outlookService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

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

    private void annualReport() {
        report(ANNUAL, ReportType.ANNUAL, "사업보고서 (2025.12)", LocalDate.of(2025, 12, 31));
        AI.on("/internal/documents/" + ANNUAL + "/structure", Reply.ok(structured(ANNUAL)));
    }

    /** '사업의 내용' 아래 생산설비 목차와 '이사의 경영진단' 대목차가 있는 구조화 결과 */
    private static String structured(String rceptNo) {
        return """
                {"rceptNo":"%1$s","parserVersion":"dart-xml-1","status":"STRUCTURED","failureCode":null,
                 "failureMessage":null,"mainFile":"%1$s.xml","encoding":"utf-8","attachments":[],"warnings":[],
                 "counts":{"cells":0,"sourceCells":0},
                 "sections":[
                  {"sectionNo":1,"parentNo":null,"level":1,"title":"II. 사업의 내용","cover":false,
                   "blocks":[{"blockNo":1,"type":"PARAGRAPH","text":"신규 사업을 추진할 계획입니다%2$s"}]},
                  {"sectionNo":2,"parentNo":1,"level":2,"title":"1. 사업의 개요","cover":false,
                   "blocks":[{"blockNo":2,"type":"PARAGRAPH","text":"사업의 개요도 확대 계획을 적었습니다%2$s"}]},
                  {"sectionNo":3,"parentNo":1,"level":2,"title":"3. 원재료 및 생산설비","cover":false,
                   "blocks":[{"blockNo":3,"type":"PARAGRAPH","text":"%3$s%2$s"},
                             {"blockNo":4,"type":"PARAGRAPH","text":"원재료 매입 현황입니다%2$s"}]},
                  {"sectionNo":4,"parentNo":null,"level":1,"title":"IV. 이사의 경영진단 및 분석의견","cover":false,
                   "blocks":[{"blockNo":5,"type":"PARAGRAPH","text":"%4$s%2$s"},
                             {"blockNo":6,"type":"PARAGRAPH","text":"지난해 실적을 설명합니다%2$s"}]}
                 ]}
                """.formatted(rceptNo, LONG, FACILITY, MARKET);
    }

    private static String reply(String status, String items) {
        return """
                {"promptVersion":"outlook-1","expressionRulesVersion":"expr-1","model":"fake-model",
                 "generatedAt":"2026-10-27T10:12:03","status":"%s","items":[%s],
                 "reviewReason":null,"blockedRules":[],
                 "calls":[{"task":"outlook","provider":"fake","model":"fake-model","promptVersion":"outlook-1",
                  "calledAt":"2026-10-27T10:12:02","traceId":"trace-o1","inputTokens":900,"outputTokens":120,
                  "latencyMs":800,"attempt":1,"outcome":"OK","error":null}]}
                """.formatted(status, items);
    }

    private static String item(String category, String summary, String quote, String... evidenceIds) {
        return "{\"category\":\"" + category + "\",\"summary\":\"" + summary + "\",\"quote\":\"" + quote
                + "\",\"evidenceIds\":[\"" + String.join("\",\"", evidenceIds) + "\"]}";
    }

    private static String twoItems() {
        return String.join(",",
                item("MARKET", "메모리 시장이 성장할 것으로 전망한다고 밝혔어요.", MARKET, ANNUAL + "#B5"),
                item("INVESTMENT", "평택 신규 라인 증설을 2026년까지 마칠 계획이라고 밝혔어요.", FACILITY,
                        ANNUAL + "#B5", ANNUAL + "#B3"));
    }

    private ResultActions outlook() throws Exception {
        return mockMvc.perform(get("/api/companies/{corpCode}/outlook", CORP));
    }

    private int rows(String table) {
        return jdbcTemplate.queryForObject("SELECT COUNT(*) FROM " + table, Integer.class);
    }

    @Test
    @DisplayName("최신 사업보고서의 대상 목차 문단으로 항목을 만들고, 종류 순서로 인용과 근거 위치를 돌려준다")
    void generatesItemsWithQuoteAndEvidenceFromLatestAnnualReport() throws Exception {
        annualReport();
        AI.on(OUTLOOKS, Reply.ok(reply("GENERATED", twoItems())));

        outlook()
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.corpCode").value(CORP))
                .andExpect(jsonPath("$.status").value("GENERATED"))
                .andExpect(jsonPath("$.reason").value(nullValue()))
                .andExpect(jsonPath("$.message").value(nullValue()))
                .andExpect(jsonPath("$.report.rceptNo").value(ANNUAL))
                .andExpect(jsonPath("$.report.reportName").value("사업보고서 (2025.12)"))
                .andExpect(jsonPath("$.report.dartUrl").value("https://dart.fss.or.kr/dsaf001/main.do?rcpNo=" + ANNUAL))
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.items[0].no").value(1))
                .andExpect(jsonPath("$.items[0].category").value("INVESTMENT"))
                .andExpect(jsonPath("$.items[0].categoryLabel").value("투자·설비"))
                .andExpect(jsonPath("$.items[0].summary").value("평택 신규 라인 증설을 2026년까지 마칠 계획이라고 밝혔어요."))
                .andExpect(jsonPath("$.items[0].quote").value(FACILITY))
                .andExpect(jsonPath("$.items[0].evidence.evidenceId").value(ANNUAL + "#B3"))
                .andExpect(jsonPath("$.items[0].evidence.rceptNo").value(ANNUAL))
                .andExpect(jsonPath("$.items[0].evidence.sectionNo").value(3))
                .andExpect(jsonPath("$.items[0].evidence.blockNo").value(3))
                .andExpect(jsonPath("$.items[0].evidence.sectionPath").value("II. 사업의 내용 > 3. 원재료 및 생산설비"))
                .andExpect(jsonPath("$.items[1].category").value("MARKET"))
                .andExpect(jsonPath("$.items[1].categoryLabel").value("시장·업황 전망"))
                .andExpect(jsonPath("$.items[1].evidence.sectionPath").value("IV. 이사의 경영진단 및 분석의견"))
                .andExpect(jsonPath("$.aiGenerated").value(true))
                .andExpect(jsonPath("$.ai.model").value("fake-model"))
                .andExpect(jsonPath("$.ai.promptVersion").value("outlook-1"))
                .andExpect(jsonPath("$.ai.generatedAt").value("2026-10-27T10:12:03"));

        List<FakeAiServer.Request> requests = AI.requests(OUTLOOKS);
        assertThat(requests).hasSize(1);
        String body = requests.getFirst().bodyText();
        assertThat(body).contains("\"promptVersion\":\"outlook-1\"", "\"companyName\":\"예시전자\"",
                "\"reportName\":\"사업보고서 (2025.12)\"");
        // 생산설비(B3·B4)와 경영진단(B5·B6)만. 사업의 내용 본문(B1)과 사업의 개요(B2)는 쓰지 않는다
        for (int blockNo : List.of(3, 4, 5, 6)) {
            assertThat(body).contains("\"evidenceId\":\"" + ANNUAL + "#B" + blockNo + "\"");
        }
        assertThat(body).doesNotContain(ANNUAL + "#B1\"", ANNUAL + "#B2\"");
        assertThat(requests.getFirst().traceId()).isNotBlank();

        Map<String, Object> call = jdbcTemplate.queryForMap(
                "SELECT analysis_id, company_briefing_id, company_outlook_id, task FROM llm_call");
        assertThat(call.get("analysis_id")).isNull();
        assertThat(call.get("company_briefing_id")).isNull();
        assertThat(call.get("company_outlook_id")).isNotNull();
        assertThat(call.get("task")).isEqualTo("outlook");
    }

    @Test
    @DisplayName("같은 보고서·프롬프트 버전이면 저장한 결과를 돌려주고 다시 만들지 않는다(AC3)")
    void savedOutlookIsReusedWithoutCallingAiServerAgain() throws Exception {
        annualReport();
        AI.on(OUTLOOKS, Reply.ok(reply("GENERATED", twoItems())));

        outlook().andExpect(status().isOk()).andExpect(jsonPath("$.status").value("GENERATED"));
        AI.on(OUTLOOKS, Reply.error(503, "AI_LLM_UNAVAILABLE", "LLM 없음"));
        outlook()
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("GENERATED"))
                .andExpect(jsonPath("$.items[0].quote").value(FACILITY))
                .andExpect(jsonPath("$.items[0].evidence.blockNo").value(3));

        assertThat(AI.requests(OUTLOOKS)).hasSize(1);
        assertThat(rows("company_outlook")).isEqualTo(1);
        assertThat(rows("llm_call")).isEqualTo(1);
    }

    @Test
    @DisplayName("인용이 원문에 없으면 항목을 버리고 검토 필요로 저장한다(AC4)")
    void quoteNotInSourceIsReviewNeeded() throws Exception {
        annualReport();
        AI.on(OUTLOOKS, Reply.ok(reply("GENERATED",
                item("INVESTMENT", "라인을 늘릴 계획이라고 밝혔어요.", "당사는 평택 라인을 크게 늘릴 것입니다.", ANNUAL + "#B3"))));

        outlook()
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REVIEW_NEEDED"))
                .andExpect(jsonPath("$.message").value("전망·계획 항목의 인용이나 근거가 보낸 원문과 맞지 않아 쓰지 않았어요."))
                .andExpect(jsonPath("$.items", hasSize(0)))
                .andExpect(jsonPath("$.aiGenerated").value(true));
        assertThat(rows("company_outlook")).isEqualTo(1);
    }

    @Test
    @DisplayName("AI 서버가 다시 만들어도 실패해 검토 필요로 답하면 저장하고 다시 만들지 않는다(AC4)")
    void reviewNeededIsSavedAndNotGeneratedAgain() throws Exception {
        annualReport();
        AI.on(OUTLOOKS, Reply.ok("""
                {"promptVersion":"outlook-1","expressionRulesVersion":"expr-1","model":"fake-model",
                 "generatedAt":"2026-10-27T10:12:03","status":"REVIEW_NEEDED","items":[],
                 "reviewReason":"투자 권유로 읽힐 수 있는 표현이 있어 전망·계획을 내보내지 않았어요.",
                 "blockedRules":["PRICE_FORECAST"],
                 "calls":[{"task":"outlook","provider":"fake","model":"fake-model","promptVersion":"outlook-1",
                  "calledAt":"2026-10-27T10:12:02","attempt":1,"latencyMs":5,"outcome":"INVALID_OUTPUT"},
                  {"task":"outlook","provider":"fake","model":"fake-model","promptVersion":"outlook-1",
                  "calledAt":"2026-10-27T10:12:02","attempt":1,"latencyMs":5,"outcome":"INVALID_OUTPUT"},
                  {"task":"outlook","provider":"fake","model":"fake-model","promptVersion":"outlook-1",
                  "calledAt":"2026-10-27T10:12:03","attempt":1,"latencyMs":5,"outcome":"INVALID_OUTPUT"}]}
                """));

        for (int i = 0; i < 2; i++) {
            outlook()
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("REVIEW_NEEDED"))
                    .andExpect(jsonPath("$.message").value("투자 권유로 읽힐 수 있는 표현이 있어 전망·계획을 내보내지 않았어요."))
                    .andExpect(jsonPath("$.items", hasSize(0)));
        }
        assertThat(AI.requests(OUTLOOKS)).hasSize(1);
        assertThat(rows("llm_call")).isEqualTo(3);
        assertThat(jdbcTemplate.queryForObject("SELECT blocked_rules FROM company_outlook", String.class))
                .isEqualTo("PRICE_FORECAST");
    }

    @Test
    @DisplayName("AI가 0개로 답하면 EMPTY로 저장하고 'AI 생성'으로 표시한다")
    void zeroItemsFromAiIsSavedAsEmpty() throws Exception {
        annualReport();
        AI.on(OUTLOOKS, Reply.ok(reply("EMPTY", "")));

        outlook()
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("EMPTY"))
                .andExpect(jsonPath("$.message").value(ReportOutlook.EMPTY_MESSAGE))
                .andExpect(jsonPath("$.items", hasSize(0)))
                .andExpect(jsonPath("$.aiGenerated").value(true));
        assertThat(rows("company_outlook")).isEqualTo(1);
    }

    @Test
    @DisplayName("계획·전망 낱말이 든 문단이 없으면 AI 서버를 부르지 않고 EMPTY, 저장하지 않는다(AC5)")
    void noPlanParagraphIsEmptyWithoutAiCall() throws Exception {
        report(ANNUAL, ReportType.ANNUAL, "사업보고서 (2025.12)", LocalDate.of(2025, 12, 31));
        AI.on("/internal/documents/" + ANNUAL + "/structure", Reply.ok(structured(ANNUAL)
                .replace(FACILITY, "당사는 평택 라인을 운영합니다.").replace(MARKET, "메모리 시장은 성장했습니다.")));

        outlook()
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("EMPTY"))
                .andExpect(jsonPath("$.message").value(ReportOutlook.EMPTY_MESSAGE))
                .andExpect(jsonPath("$.aiGenerated").value(false))
                .andExpect(jsonPath("$.ai").value(nullValue()))
                .andExpect(jsonPath("$.report.rceptNo").value(ANNUAL));
        assertThat(AI.requests(OUTLOOKS)).isEmpty();
        assertThat(rows("company_outlook")).isZero();
    }

    @Test
    @DisplayName("사업보고서가 없으면 반기보고서로 대신하지 않고 NOT_AVAILABLE(NO_REPORT)(AC7)")
    void noAnnualReportIsNotAvailable() throws Exception {
        report(HALF, ReportType.HALF, "반기보고서 (2026.06)", LocalDate.of(2026, 6, 30));

        outlook()
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NOT_AVAILABLE"))
                .andExpect(jsonPath("$.reason").value("NO_REPORT"))
                .andExpect(jsonPath("$.message").isNotEmpty())
                .andExpect(jsonPath("$.report").value(nullValue()))
                .andExpect(jsonPath("$.items", hasSize(0)))
                .andExpect(jsonPath("$.aiGenerated").value(false))
                .andExpect(jsonPath("$.ai").value(nullValue()));
        assertThat(AI.requests(OUTLOOKS)).isEmpty();
    }

    @Test
    @DisplayName("원문에 대상 목차가 없으면 NOT_AVAILABLE(NO_SOURCE), 저장하지 않는다")
    void documentWithoutTargetSectionsIsNotAvailable() throws Exception {
        report(ANNUAL, ReportType.ANNUAL, "사업보고서 (2025.12)", LocalDate.of(2025, 12, 31));
        AI.on("/internal/documents/" + ANNUAL + "/structure", Reply.ok(structured(ANNUAL)
                .replace("3. 원재료 및 생산설비", "3. 원재료").replace("IV. 이사의 경영진단 및 분석의견", "IV. 다른 항목")));

        outlook()
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NOT_AVAILABLE"))
                .andExpect(jsonPath("$.reason").value("NO_SOURCE"));
        assertThat(AI.requests(OUTLOOKS)).isEmpty();
        assertThat(rows("company_outlook")).isZero();
    }

    @Test
    @DisplayName("AI 서버를 쓸 수 없으면 503이고 저장하지 않아 다음 요청에서 다시 만든다")
    void aiServerFailureIsNotSaved() throws Exception {
        annualReport();
        AI.on(OUTLOOKS, Reply.error(503, "AI_LLM_UNAVAILABLE", "LLM 없음"));

        outlook()
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("AI_SERVER_UNAVAILABLE"));
        assertThat(rows("company_outlook")).isZero();

        AI.on(OUTLOOKS, Reply.ok(reply("GENERATED", twoItems())));
        outlook().andExpect(status().isOk()).andExpect(jsonPath("$.status").value("GENERATED"));
        assertThat(AI.requests(OUTLOOKS)).hasSize(2);
    }

    @Test
    @DisplayName("접수번호 하나로 그 보고서의 전망·계획을 만들거나 저장된 것을 돌려준다(FS-60용)")
    void forReportReturnsSavedOrGeneratedOutlook() {
        annualReport();
        AI.on(OUTLOOKS, Reply.ok(reply("GENERATED", twoItems())));

        ReportOutlook first = outlookService.forReport(ANNUAL);
        ReportOutlook second = outlookService.forReport(ANNUAL);

        assertThat(first.status()).isEqualTo(OutlookStatus.GENERATED);
        assertThat(first.items()).extracting(i -> i.category())
                .containsExactly(OutlookCategory.INVESTMENT, OutlookCategory.MARKET);
        assertThat(second.saved().id()).isEqualTo(first.saved().id());
        assertThat(AI.requests(OUTLOOKS)).hasSize(1);
        assertThat(AI.requests(OUTLOOKS).getFirst().bodyText()).contains("\"companyName\":\"예시전자\"");
    }

    @Test
    @DisplayName("없는 기업은 404 COMPANY_NOT_FOUND")
    void unknownCompanyIsNotFound() throws Exception {
        mockMvc.perform(get("/api/companies/{corpCode}/outlook", "99999999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COMPANY_NOT_FOUND"));
    }
}
