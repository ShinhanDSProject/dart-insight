package com.dartinsight.briefing.controller;

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

/** AI 기업 브리핑(1.2, ADR-0025): GET /api/companies/{corpCode}/briefing, 가짜 OpenDART(원문)·AI 서버 */
@SpringBootTest
@AutoConfigureMockMvc
class BriefingApiTest {

    static final FakeOpenDartServer DART = startDart();
    static final FakeAiServer AI = new FakeAiServer();
    static final String CORP = "00000001";
    static final String ANNUAL = "20260310000001";
    static final String HALF = "20260814000001";
    static final String BRIEFINGS = "/internal/briefings";
    static final String PARSER = "/internal/documents/parser";
    static final String DOCUMENT = "/api/document.xml";
    static final String LONG = "에 관한 내용을 원문에 충분히 길게 적은 문단입니다. 이 문단은 마흔 자를 넘습니다.";

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
    }

    /** 'II. 사업의 내용' 하위 목차와 '투자자 보호' 대목차가 있는 구조화 결과 */
    private static String structured(String rceptNo) {
        return """
                {"rceptNo":"%1$s","parserVersion":"dart-xml-1","status":"STRUCTURED","failureCode":null,
                 "failureMessage":null,"mainFile":"%1$s.xml","encoding":"utf-8","attachments":[],"warnings":[],
                 "counts":{"cells":0,"sourceCells":0},
                 "sections":[
                  {"sectionNo":1,"parentNo":null,"level":1,"title":"I. 회사의 개요","cover":false,
                   "blocks":[{"blockNo":1,"type":"PARAGRAPH","text":"회사의 개요%2$s"}]},
                  {"sectionNo":2,"parentNo":null,"level":1,"title":"II. 사업의 내용","cover":false,
                   "blocks":[{"blockNo":2,"type":"PARAGRAPH","text":"가. 개요"}]},
                  {"sectionNo":3,"parentNo":2,"level":2,"title":"1. 사업의 개요","cover":false,
                   "blocks":[{"blockNo":3,"type":"PARAGRAPH","text":"당사는 반도체와 스마트폰을 만들어 판매합니다%2$s"},
                             {"blockNo":4,"type":"PARAGRAPH","text":"사업 부문%2$s"}]},
                  {"sectionNo":4,"parentNo":2,"level":2,"title":"2. 주요 제품 및 서비스","cover":false,
                   "blocks":[{"blockNo":5,"type":"TABLE","text":"제품 | 비중\\n스마트폰 | 58.1%%"}]},
                  {"sectionNo":5,"parentNo":2,"level":2,"title":"4. 매출 및 수주상황","cover":false,
                   "blocks":[{"blockNo":6,"type":"PARAGRAPH","text":"당기 매출액은 300조 원입니다%2$s"}]},
                  {"sectionNo":6,"parentNo":2,"level":2,"title":"5. 위험관리 및 파생거래","cover":false,
                   "blocks":[{"blockNo":7,"type":"PARAGRAPH","text":"환율 변동 위험%2$s"}]},
                  {"sectionNo":7,"parentNo":null,"level":1,"title":"XI. 그 밖에 투자자 보호를 위하여 필요한 사항",
                   "cover":false,"blocks":[{"blockNo":8,"type":"PARAGRAPH","text":"우발부채%2$s"}]}
                 ]}
                """.formatted(rceptNo, LONG);
    }

    private static String generated(String sentences) {
        return """
                {"promptVersion":"briefing-1","expressionRulesVersion":"expr-1","model":"fake-model",
                 "generatedAt":"2026-10-26T10:12:03","status":"GENERATED","sentences":[%s],
                 "reviewReason":null,"blockedRules":[],
                 "calls":[{"task":"briefing","provider":"fake","model":"fake-model","promptVersion":"briefing-1",
                  "calledAt":"2026-10-26T10:12:02","traceId":"trace-b1","inputTokens":900,"outputTokens":120,
                  "latencyMs":800,"attempt":1,"outcome":"OK","error":null}]}
                """.formatted(sentences);
    }

    private static String sentence(String text, String... evidenceIds) {
        return "{\"text\":\"" + text + "\",\"evidenceIds\":[\"" + String.join("\",\"", evidenceIds) + "\"]}";
    }

    private ResultActions briefing() throws Exception {
        return mockMvc.perform(get("/api/companies/{corpCode}/briefing", CORP));
    }

    private int rows(String table) {
        return jdbcTemplate.queryForObject("SELECT COUNT(*) FROM " + table, Integer.class);
    }

    @Test
    @DisplayName("최신 사업보고서 원문에서 근거를 골라 브리핑을 만들고, 문장마다 원문 위치를 돌려준다")
    void generatesBriefingWithEvidenceFromLatestAnnualReport() throws Exception {
        annualReport();
        AI.on("/internal/documents/" + ANNUAL + "/structure", Reply.ok(structured(ANNUAL)));
        AI.on(BRIEFINGS, Reply.ok(generated(String.join(",",
                sentence("회사는 반도체와 스마트폰을 만들어 판매해요.", ANNUAL + "#B3"),
                sentence("당기 매출액은 300조 원이에요.", ANNUAL + "#B6", ANNUAL + "#B3")))));

        briefing()
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.corpCode").value(CORP))
                .andExpect(jsonPath("$.status").value("GENERATED"))
                .andExpect(jsonPath("$.reason").value(nullValue()))
                .andExpect(jsonPath("$.message").value(nullValue()))
                .andExpect(jsonPath("$.report.rceptNo").value(ANNUAL))
                .andExpect(jsonPath("$.report.reportName").value("사업보고서 (2025.12)"))
                .andExpect(jsonPath("$.report.reportType").value("ANNUAL"))
                .andExpect(jsonPath("$.report.dartUrl").value("https://dart.fss.or.kr/dsaf001/main.do?rcpNo=" + ANNUAL))
                .andExpect(jsonPath("$.sentences", hasSize(2)))
                .andExpect(jsonPath("$.sentences[0].no").value(1))
                .andExpect(jsonPath("$.sentences[0].text").value("회사는 반도체와 스마트폰을 만들어 판매해요."))
                .andExpect(jsonPath("$.sentences[0].evidence[0].evidenceId").value(ANNUAL + "#B3"))
                .andExpect(jsonPath("$.sentences[0].evidence[0].rceptNo").value(ANNUAL))
                .andExpect(jsonPath("$.sentences[0].evidence[0].sectionNo").value(3))
                .andExpect(jsonPath("$.sentences[0].evidence[0].blockNo").value(3))
                .andExpect(jsonPath("$.sentences[0].evidence[0].sectionPath").value("II. 사업의 내용 > 1. 사업의 개요"))
                .andExpect(jsonPath("$.sentences[0].evidence[0].quote").value("당사는 반도체와 스마트폰을 만들어 판매합니다" + LONG))
                .andExpect(jsonPath("$.sentences[1].evidence", hasSize(2)))
                .andExpect(jsonPath("$.aiGenerated").value(true))
                .andExpect(jsonPath("$.ai.model").value("fake-model"))
                .andExpect(jsonPath("$.ai.promptVersion").value("briefing-1"))
                .andExpect(jsonPath("$.ai.generatedAt").value("2026-10-26T10:12:03"));

        List<FakeAiServer.Request> requests = AI.requests(BRIEFINGS);
        assertThat(requests).hasSize(1);
        String body = requests.getFirst().bodyText();
        assertThat(body).contains("\"promptVersion\":\"briefing-1\"", "\"companyName\":\"예시전자\"",
                "\"reportName\":\"사업보고서 (2025.12)\"");
        // 개요 2개(짧은 소제목 B2 제외), 제품 표, 매출, 위험관리 + 투자자 보호로 채운 위험. 회사의 개요(B1)는 쓰지 않는다
        for (String expected : List.of("#B3\",\"topic\":\"OVERVIEW\"", "#B4\",\"topic\":\"OVERVIEW\"",
                "#B5\",\"topic\":\"PRODUCTS\"", "#B6\",\"topic\":\"SALES\"", "#B7\",\"topic\":\"RISK\"",
                "#B8\",\"topic\":\"RISK\"")) {
            assertThat(body).contains(ANNUAL + expected);
        }
        assertThat(body).doesNotContain(ANNUAL + "#B1\"", ANNUAL + "#B2\"");
        assertThat(requests.getFirst().traceId()).isNotBlank();

        Map<String, Object> call = jdbcTemplate.queryForMap(
                "SELECT analysis_id, company_briefing_id, task, prompt_version FROM llm_call");
        assertThat(call.get("analysis_id")).isNull();
        assertThat(call.get("company_briefing_id")).isNotNull();
        assertThat(call.get("task")).isEqualTo("briefing");
    }

    @Test
    @DisplayName("같은 보고서·프롬프트 버전이면 저장한 브리핑을 돌려주고 다시 만들지 않는다")
    void savedBriefingIsReusedWithoutCallingAiServerAgain() throws Exception {
        annualReport();
        AI.on("/internal/documents/" + ANNUAL + "/structure", Reply.ok(structured(ANNUAL)));
        AI.on(BRIEFINGS, Reply.ok(generated(sentence("회사는 반도체를 만들어요.", ANNUAL + "#B3"))));

        briefing().andExpect(status().isOk()).andExpect(jsonPath("$.status").value("GENERATED"));
        AI.on(BRIEFINGS, Reply.error(503, "AI_LLM_UNAVAILABLE", "LLM 없음"));
        briefing()
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("GENERATED"))
                .andExpect(jsonPath("$.sentences[0].text").value("회사는 반도체를 만들어요."))
                .andExpect(jsonPath("$.sentences[0].evidence[0].sectionPath").value("II. 사업의 내용 > 1. 사업의 개요"));

        assertThat(AI.requests(BRIEFINGS)).hasSize(1);
        assertThat(rows("company_briefing")).isEqualTo(1);
        assertThat(rows("llm_call")).isEqualTo(1);
    }

    @Test
    @DisplayName("사업보고서가 있으면 더 최근 반기보고서보다 사업보고서를 원문으로 쓴다")
    void annualReportIsPreferredOverNewerPeriodicReport() throws Exception {
        annualReport();
        report(HALF, ReportType.HALF, "반기보고서 (2026.06)", LocalDate.of(2026, 6, 30));
        AI.on("/internal/documents/" + ANNUAL + "/structure", Reply.ok(structured(ANNUAL)));
        AI.on(BRIEFINGS, Reply.ok(generated(sentence("회사는 반도체를 만들어요.", ANNUAL + "#B3"))));

        briefing().andExpect(status().isOk()).andExpect(jsonPath("$.report.rceptNo").value(ANNUAL));
    }

    @Test
    @DisplayName("사업보고서가 없으면 가장 최근 정기보고서를 쓴다")
    void latestPeriodicReportIsUsedWithoutAnnualReport() throws Exception {
        report(HALF, ReportType.HALF, "반기보고서 (2026.06)", LocalDate.of(2026, 6, 30));
        DART.on(DOCUMENT, Response.zip(TestDocuments.zip(HALF)));
        AI.on("/internal/documents/" + HALF + "/structure", Reply.ok(structured(HALF)));
        AI.on(BRIEFINGS, Reply.ok(generated(sentence("회사는 반도체를 만들어요.", HALF + "#B3"))));

        briefing()
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("GENERATED"))
                .andExpect(jsonPath("$.report.reportType").value("HALF"));
    }

    @Test
    @DisplayName("다시 만들어도 검증에 실패했으면 검토 필요로 저장하고 다시 만들지 않는다")
    void reviewNeededIsSavedAndNotGeneratedAgain() throws Exception {
        annualReport();
        AI.on("/internal/documents/" + ANNUAL + "/structure", Reply.ok(structured(ANNUAL)));
        AI.on(BRIEFINGS, Reply.ok("""
                {"promptVersion":"briefing-1","expressionRulesVersion":"expr-1","model":"fake-model",
                 "generatedAt":"2026-10-26T10:12:03","status":"REVIEW_NEEDED","sentences":[],
                 "reviewReason":"다시 생성해도 근거·숫자 확인을 통과하지 못했어요.","blockedRules":["VALUE_JUDGMENT"],
                 "calls":[{"task":"briefing","provider":"fake","model":"fake-model","promptVersion":"briefing-1",
                  "calledAt":"2026-10-26T10:12:02","attempt":1,"latencyMs":5,"outcome":"INVALID_OUTPUT"},
                  {"task":"briefing","provider":"fake","model":"fake-model","promptVersion":"briefing-1",
                  "calledAt":"2026-10-26T10:12:02","attempt":1,"latencyMs":5,"outcome":"INVALID_OUTPUT"},
                  {"task":"briefing","provider":"fake","model":"fake-model","promptVersion":"briefing-1",
                  "calledAt":"2026-10-26T10:12:03","attempt":1,"latencyMs":5,"outcome":"INVALID_OUTPUT"}]}
                """));

        for (int i = 0; i < 2; i++) {
            briefing()
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("REVIEW_NEEDED"))
                    .andExpect(jsonPath("$.message").value("다시 생성해도 근거·숫자 확인을 통과하지 못했어요."))
                    .andExpect(jsonPath("$.sentences", hasSize(0)))
                    .andExpect(jsonPath("$.aiGenerated").value(true))
                    .andExpect(jsonPath("$.ai.promptVersion").value("briefing-1"));
        }
        assertThat(AI.requests(BRIEFINGS)).hasSize(1);
        assertThat(rows("llm_call")).isEqualTo(3);
        assertThat(jdbcTemplate.queryForObject("SELECT blocked_rules FROM company_briefing", String.class))
                .isEqualTo("VALUE_JUDGMENT");
    }

    @Test
    @DisplayName("AI 서버가 보내지 않은 근거를 쓰면 문장을 버리고 검토 필요로 둔다")
    void sentenceCitingUnknownBlockIsReviewNeeded() throws Exception {
        annualReport();
        AI.on("/internal/documents/" + ANNUAL + "/structure", Reply.ok(structured(ANNUAL)));
        AI.on(BRIEFINGS, Reply.ok(generated(String.join(",",
                sentence("회사는 반도체를 만들어요.", ANNUAL + "#B3"),
                sentence("회사의 개요예요.", ANNUAL + "#B1")))));

        briefing()
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REVIEW_NEEDED"))
                .andExpect(jsonPath("$.message").value("브리핑 문장의 근거가 보낸 원문 위치가 아니라 쓰지 않았어요."))
                .andExpect(jsonPath("$.sentences", hasSize(0)));
    }

    @Test
    @DisplayName("AI 서버를 쓸 수 없으면 503이고 저장하지 않아 다음 요청에서 다시 만든다")
    void aiServerFailureIsNotSaved() throws Exception {
        annualReport();
        AI.on("/internal/documents/" + ANNUAL + "/structure", Reply.ok(structured(ANNUAL)));
        AI.on(BRIEFINGS, Reply.error(503, "AI_LLM_UNAVAILABLE", "LLM 없음"));

        briefing()
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("AI_SERVER_UNAVAILABLE"));
        assertThat(rows("company_briefing")).isZero();

        AI.on(BRIEFINGS, Reply.ok(generated(sentence("회사는 반도체를 만들어요.", ANNUAL + "#B3"))));
        briefing().andExpect(status().isOk()).andExpect(jsonPath("$.status").value("GENERATED"));
        assertThat(AI.requests(BRIEFINGS)).hasSize(2);
    }

    @Test
    @DisplayName("정기보고서가 없으면 AI 서버를 부르지 않고 NOT_AVAILABLE(NO_REPORT)")
    void noReportIsNotAvailable() throws Exception {
        briefing()
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NOT_AVAILABLE"))
                .andExpect(jsonPath("$.reason").value("NO_REPORT"))
                .andExpect(jsonPath("$.message").isNotEmpty())
                .andExpect(jsonPath("$.report").value(nullValue()))
                .andExpect(jsonPath("$.sentences", hasSize(0)))
                .andExpect(jsonPath("$.aiGenerated").value(false))
                .andExpect(jsonPath("$.ai").value(nullValue()));
        assertThat(AI.requests(BRIEFINGS)).isEmpty();
    }

    @Test
    @DisplayName("원문에 '사업의 내용'이 없으면 AI 서버를 부르지 않고 NOT_AVAILABLE(NO_SOURCE), 저장하지 않는다")
    void documentWithoutBusinessSectionIsNotAvailable() throws Exception {
        annualReport();
        AI.on("/internal/documents/" + ANNUAL + "/structure", Reply.ok(structured(ANNUAL)
                .replace("II. 사업의 내용", "II. 다른 항목")));

        briefing()
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NOT_AVAILABLE"))
                .andExpect(jsonPath("$.reason").value("NO_SOURCE"))
                .andExpect(jsonPath("$.report.rceptNo").value(ANNUAL));
        assertThat(AI.requests(BRIEFINGS)).isEmpty();
        assertThat(rows("company_briefing")).isZero();
    }

    @Test
    @DisplayName("원문 구조화에 실패하면 NOT_AVAILABLE(NO_DOCUMENT)")
    void unreadableDocumentIsNotAvailable() throws Exception {
        annualReport();
        AI.on("/internal/documents/" + ANNUAL + "/structure", Reply.ok(structured(ANNUAL)
                .replace("\"status\":\"STRUCTURED\",\"failureCode\":null",
                        "\"status\":\"FAILED\",\"failureCode\":\"UNSUPPORTED\"")));

        briefing()
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NOT_AVAILABLE"))
                .andExpect(jsonPath("$.reason").value("NO_DOCUMENT"));
        assertThat(AI.requests(BRIEFINGS)).isEmpty();
    }

    @Test
    @DisplayName("없는 기업은 404 COMPANY_NOT_FOUND")
    void unknownCompanyIsNotFound() throws Exception {
        mockMvc.perform(get("/api/companies/{corpCode}/briefing", "99999999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COMPANY_NOT_FOUND"));
    }
}
