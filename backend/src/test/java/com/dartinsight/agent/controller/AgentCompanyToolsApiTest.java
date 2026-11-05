package com.dartinsight.agent.controller;

import static com.dartinsight.dart.client.DisclosureListJson.item;
import static com.dartinsight.dart.client.FinancialJson.account;
import static com.dartinsight.dart.client.DisclosureListJson.page;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
import com.dartinsight.company.repository.CompanyRepository;
import com.dartinsight.company.service.CompanyImportService;
import com.dartinsight.comparison.domain.ComparisonBasis;
import com.dartinsight.dart.client.FakeOpenDartServer;
import com.dartinsight.dart.client.FinancialJson;
import com.dartinsight.dart.client.FakeOpenDartServer.Response;
import com.dartinsight.dart.domain.CorpCodeEntry;
import com.dartinsight.financial.domain.FsDiv;
import com.dartinsight.report.domain.Correction;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.domain.ReportNameParser.ParsedReportName;
import com.dartinsight.report.domain.ReportType;
import com.dartinsight.report.repository.ReportRepository;
import com.dartinsight.summary.domain.SummaryResult;
import com.dartinsight.summary.domain.SummaryStatus;
import com.dartinsight.support.TestData;
import com.dartinsight.support.TestDocuments;
import com.jayway.jsonpath.JsonPath;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.function.Function;
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

/** 에이전트 채팅의 기업·기간 Tool(#582): 가짜 AI 서버와 가짜 OpenDART로 Tool 결과·근거를 확인한다 */
@SpringBootTest
@AutoConfigureMockMvc
class AgentCompanyToolsApiTest {

    static final FakeAiServer AI = new FakeAiServer();
    static final FakeOpenDartServer DART = startDart();
    static final String STEPS = "/internal/agent-steps";
    static final String CORP = "00000001";
    static final String CUR = "20260814003699";
    static final String PREV = "20250814003156";
    static final String ANNUAL = "20260310000001";
    static final String Q1 = "20260515000001";
    /** 날짜를 고정하면 보고서 목록 refresh-after(24h)가 지난 뒤 목록을 다시 받아 테스트가 실패한다 */
    static final LocalDateTime NOW = LocalDateTime.now().truncatedTo(ChronoUnit.SECONDS);
    static final String CALL = """
            {"task":"%s","provider":"fake","model":"fake-model","promptVersion":"agent-2",
             "calledAt":"2026-11-04T10:12:02","traceId":"trace-agent","inputTokens":100,"outputTokens":20,
             "latencyMs":50,"attempt":1,"outcome":"OK","error":null}
            """;
    static final String LONG = " 이 문단은 근거로 쓸 수 있을 만큼 원문에 충분히 길게 적었습니다. 마흔 자를 넘습니다.";
    static final String FACILITY = "당사는 평택 신규 라인 증설을 2026년까지 완료할 계획입니다.";
    static final String MARKET = "메모리 시장은 수요 회복으로 성장할 것으로 전망합니다.";

    @DynamicPropertySource
    static void servers(DynamicPropertyRegistry registry) {
        registry.add("app.ai-server.base-url", AI::baseUrl);
        registry.add("app.opendart.base-url", DART::baseUrl);
        registry.add("app.opendart.read-timeout", () -> "2s");
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
    private Clock clock;

    @Autowired
    private AnalysisRepository analysisRepository;

    @Autowired
    private AnalysisResultService resultService;

    @Autowired
    private CompanyImportService companyImportService;

    @Autowired
    private ReportRepository reportRepository;

    @Autowired
    private CompanyRepository companyRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private Long analysisId;

    @BeforeEach
    void setUp() {
        TestData.clearAll(jdbcTemplate);
        TestDocuments.clearCache();
        AI.clear();
        companyImportService.save(List.of(
                new CorpCodeEntry(CORP, "예시전자", null, "900001", LocalDate.of(2026, 1, 1)),
                new CorpCodeEntry("00000002", "예시전자서비스", null, null, LocalDate.of(2026, 1, 1))));
        for (int year : new int[] {2025, 2026}) {
            reportRepository.save(Report.create(year == 2026 ? CUR : PREV, CORP, "반기보고서 (" + year + ".06)",
                    new ParsedReportName(ReportType.HALF, year, LocalDate.of(year, 6, 30), Correction.ORIGINAL),
                    LocalDate.of(year, 8, 14), null, "예시전자", NOW));
        }
        Analysis analysis = Analysis.request(CORP, CUR, PREV, ComparisonBasis.YOY, null, NOW);
        analysis.start(NOW);
        analysis.recordFsDiv(FsDiv.CFS);
        analysisId = analysisRepository.save(analysis).getId();
        resultService.saveAndComplete(analysisId, List.of(), new TextComparison(TextStatus.COMPLETED, null, List.of()),
                new SummaryResult(SummaryStatus.COMPLETED, null, List.of(), List.of()));
        DART.on("/api/list.json", Response.json(page(1, 1,
                item(CUR, "반기보고서 (2026.06)", "20260814", ""),
                item(PREV, "반기보고서 (2025.06)", "20250814", ""))));
        DART.on("/api/hyslrSttus.json", keyFact("major-shareholders-2026-half"),
                keyFact("major-shareholders-2025-half"));
        DART.on("/api/exctvSttus.json", keyFact("executives-2026-half"), keyFact("executives-2025-half"));
        DART.on("/api/alotMatter.json", keyFact("dividends-2026-half"), keyFact("dividends-2025-half"));
    }

    private static Response keyFact(String name) {
        try (InputStream in = AgentCompanyToolsApiTest.class.getResourceAsStream(
                "/opendart/key-facts/" + name + ".json")) {
            if (in == null) {
                throw new IllegalStateException("테스트 자료가 없습니다: " + name);
            }
            return Response.json(new String(in.readAllBytes(), StandardCharsets.UTF_8));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private ResultActions chat(String message) throws Exception {
        return mockMvc.perform(post("/api/analyses/{a}/chat-messages", analysisId).header("X-Trace-Id", "trace-agent")
                .contentType(MediaType.APPLICATION_JSON).content("{\"message\":\"" + message + "\"}"));
    }

    private static String toolCalls(String calls) {
        return """
                {"promptVersion":"agent-2","model":"fake-model","generatedAt":"2026-11-04T10:12:03",
                 "type":"TOOL_CALLS","toolCalls":[%s],"final":null,"rejections":[],"calls":[%s]}
                """.formatted(calls, CALL.formatted("agent_plan"));
    }

    private static String finalAnswer(String answer, String evidenceIds) {
        return finalAnswer(answer, evidenceIds, "");
    }

    private static String finalAnswer(String answer, String evidenceIds, String actions) {
        return """
                {"promptVersion":"agent-2","model":"fake-model","generatedAt":"2026-11-04T10:12:03","type":"FINAL",
                 "toolCalls":[],"final":{"status":"ANSWERED","answer":"%s","evidenceIds":[%s],"actions":[%s],
                 "reviewReason":null,"blockedRules":[],"format":"CHAT","crossCheck":null},
                 "rejections":[],"calls":[%s]}
                """.formatted(answer, evidenceIds, actions, CALL.formatted("agent_answer"));
    }

    /** 첫 단계는 Tool 호출, Tool 결과가 붙은 다음 단계는 then이 만든 답 */
    private static Function<FakeAiServer.Request, Reply> twoSteps(String calls,
            Function<FakeAiServer.Request, String> then) {
        return request -> {
            List<?> results = JsonPath.read(request.bodyText(), "$.toolResults");
            return Reply.ok(results.isEmpty() ? toolCalls(calls) : then.apply(request));
        };
    }

    private static String call(String name, String arguments) {
        return "{\"callId\":\"c1\",\"name\":\"" + name + "\",\"arguments\":" + arguments + "}";
    }

    @Test
    @DisplayName("'최대주주 바뀌었어?'에 최대주주 변화를 보고서 값 근거({접수번호}#V{n})로 넘기고, 답의 근거 칩에 접수번호·항목·값이 그대로 붙는다(AC22)")
    void keyFactChangeIsReportValueEvidence() throws Exception {
        AI.on(STEPS, twoSteps(call("get_key_facts", "{}"), request -> {
            String body = request.bodyText();
            List<String> ids = JsonPath.read(body, "$.toolResults[0].items[*].evidenceId");
            List<String> texts = JsonPath.read(body, "$.toolResults[0].items[*].text");
            assertThat(JsonPath.<Boolean>read(body, "$.toolResults[0].ok")).isTrue();
            int first = texts.indexOf(texts.stream().filter(t -> t.startsWith("[최대주주 변화")).findFirst().orElseThrow());
            assertThat(texts.get(first)).contains("홍라희", "1.66 → 1.25");
            String id = ids.get(first);
            assertThat(id).isEqualTo(CUR + "#V1");
            return finalAnswer("홍라희의 지분율이 1.66에서 1.25로 바뀌었어요[" + id + "].", "\"" + id + "\"");
        }));

        chat("최대주주 바뀌었어?")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ANSWERED"))
                .andExpect(jsonPath("$.answer").value("홍라희의 지분율이 1.66에서 1.25로 바뀌었어요[1]."))
                .andExpect(jsonPath("$.citations[0].kind").value("REPORT_VALUE"))
                .andExpect(jsonPath("$.citations[0].evidenceId").value(CUR + "#V1"))
                .andExpect(jsonPath("$.citations[0].rceptNo").value(CUR))
                .andExpect(jsonPath("$.citations[0].reportName").value("반기보고서 (2026.06)"))
                .andExpect(jsonPath("$.citations[0].source").value("KEY_FACT"))
                .andExpect(jsonPath("$.citations[0].label").value(startsWith("최대주주 변화")))
                .andExpect(jsonPath("$.citations[0].value").value("1.25"))
                .andExpect(jsonPath("$.citations[0].dartUrl").value(
                        "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=" + CUR));
    }

    @Test
    @DisplayName("같은 이름의 기업이 여럿이면 기업 검색 결과마다 기업 근거(C{고유번호})를 넘겨 답이 후보를 인용해 되물을 수 있다(AC27)")
    void companySearchCandidatesAreCompanyEvidence() throws Exception {
        AI.on(STEPS, twoSteps(call("search_companies", "{\"query\":\"예시전자\"}"), request -> {
            List<String> ids = JsonPath.read(request.bodyText(), "$.toolResults[0].items[*].evidenceId");
            assertThat(ids).contains("C" + CORP, "C00000002");
            return finalAnswer("예시전자[C" + CORP + "]와 예시전자서비스[C00000002] 중 어느 기업인지 알려 주세요.",
                    "\"C" + CORP + "\",\"C00000002\"");
        }));

        chat("예시전자 최대주주 알려줘")
                .andExpect(jsonPath("$.status").value("ANSWERED"))
                .andExpect(jsonPath("$.answer").value("예시전자[1]와 예시전자서비스[2] 중 어느 기업인지 알려 주세요."))
                .andExpect(jsonPath("$.citations[0].kind").value("COMPANY"))
                .andExpect(jsonPath("$.citations[0].corpCode").value(CORP))
                .andExpect(jsonPath("$.citations[0].corpName").value("예시전자"))
                .andExpect(jsonPath("$.citations[0].label").value("기업 검색"))
                .andExpect(jsonPath("$.citations[0].value").value("900001"))
                .andExpect(jsonPath("$.citations[1].corpCode").value("00000002"))
                .andExpect(jsonPath("$.citations[1].value").doesNotExist());
    }

    @Test
    @DisplayName("없는 기업의 고유번호를 주면 Tool을 실행하지 않고 실패 결과(ok: false)를 넘긴다")
    void unknownCompanyIsFailedToolResult() throws Exception {
        AI.on(STEPS, twoSteps(call("get_company_overview", "{\"corpCode\":\"99999999\"}"), request -> {
            assertThat(JsonPath.<Boolean>read(request.bodyText(), "$.toolResults[0].ok")).isFalse();
            assertThat(JsonPath.<String>read(request.bodyText(), "$.toolResults[0].error")).contains("없는 기업");
            return """
                    {"promptVersion":"agent-2","model":"fake-model","generatedAt":"2026-11-04T10:12:03","type":"FINAL",
                     "toolCalls":[],"final":{"status":"NOT_FOUND","answer":null,"evidenceIds":[],"actions":[],
                     "reviewReason":null,"blockedRules":[],"format":"CHAT","crossCheck":null},
                     "rejections":[],"calls":[]}
                    """;
        }));

        chat("99999999 기업 개황 알려줘").andExpect(jsonPath("$.status").value("NOT_FOUND"));
        assertThat(AI.requests(STEPS)).hasSize(2);
    }

    @Test
    @DisplayName("수시공시 주요정보는 값을 API 그대로 넘기고, 정정본 값이면 근거 접수번호를 그 정정본(sourceRceptNo)으로 한다")
    void keyItemValueUsesSourceRceptNo() throws Exception {
        String original = "20260630000676";
        String corrected = "20261013000198";
        jdbcTemplate.update("INSERT INTO company_disclosure (corp_code, rcept_no, report_name, filer_name, rcept_dt,"
                + " remark, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", CORP, original, "주요사항보고서(유상증자결정)",
                "예시전자", Date.valueOf("2026-06-30"), "정", Timestamp.valueOf(NOW));
        DART.on("/api/piicDecsn.json", keyItem("capital-increase-ecoprobm-original-20260630000676"));
        AI.on(STEPS, twoSteps(call("get_disclosure_key_items", "{\"rceptNo\":\"" + original + "\"}"),
                request -> finalAnswer("새로 발행하는 주식은 9,900,990주예요[" + corrected + "#V1].",
                        "\"" + corrected + "#V1\"")));

        ResultActions result = chat("유상증자 주식 수 알려줘");
        String sent = AI.requests(STEPS).get(1).bodyText();
        assertThat(JsonPath.<List<String>>read(sent, "$.toolResults[0].items[*].evidenceId")).first()
                .isEqualTo(corrected + "#V1");
        result.andExpect(jsonPath("$.status").value("ANSWERED"))
                .andExpect(jsonPath("$.citations[0].kind").value("REPORT_VALUE"))
                .andExpect(jsonPath("$.citations[0].rceptNo").value(corrected))
                .andExpect(jsonPath("$.citations[0].source").value("DISCLOSURE_KEY_ITEM"))
                .andExpect(jsonPath("$.citations[0].value").value("9,900,990"))
                .andExpect(jsonPath("$.citations[0].dartUrl").value(
                        "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=" + corrected));
    }

    private static Response keyItem(String name) {
        try (InputStream in = AgentCompanyToolsApiTest.class.getResourceAsStream(
                "/opendart/key-items/" + name + ".json")) {
            if (in == null) {
                throw new IllegalStateException("테스트 자료가 없습니다: " + name);
            }
            return Response.json(new String(in.readAllBytes(), StandardCharsets.UTF_8));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    @Test
    @DisplayName("'회사가 밝힌 계획은?'에 전망·계획의 인용을 원문 문단 근거({접수번호}#B{번호})로 넘긴다(AC23)")
    void outlookQuoteIsBlockEvidence() throws Exception {
        Company company = companyRepository.findByCorpCode(CORP).orElseThrow();
        // 목록을 받은 지 24시간(refresh-after)이 지나면 다시 받으므로, 고정 시각(NOW)이 아니라 지금 시각으로 둔다.
        // 저장된 목록은 받은 시각 이후에 본 보고서만 돌려주므로 보고서도 같은 시각으로 만든다
        LocalDateTime fetchedAt = LocalDateTime.now(clock);
        company.markReportsFetched(fetchedAt);
        companyRepository.save(company);
        reportRepository.save(Report.create(ANNUAL, CORP, "사업보고서 (2025.12)",
                new ParsedReportName(ReportType.ANNUAL, 2025, LocalDate.of(2025, 12, 31), Correction.ORIGINAL),
                LocalDate.of(2026, 3, 10), null, "예시전자", fetchedAt));
        AI.on("/internal/documents/parser", Reply.ok("{\"parserVersion\":\"dart-xml-1\"}"));
        DART.on("/api/document.xml", Response.zip(TestDocuments.zip(ANNUAL)));
        AI.on("/internal/documents/" + ANNUAL + "/structure", Reply.ok(structured()));
        AI.on("/internal/outlooks", Reply.ok("""
                {"promptVersion":"outlook-1","expressionRulesVersion":"expr-1","model":"fake-model",
                 "generatedAt":"2026-11-04T10:12:03","status":"GENERATED","items":[
                  {"category":"INVESTMENT","summary":"평택 신규 라인 증설을 2026년까지 마칠 계획이라고 밝혔어요.",
                   "quote":"%s","evidenceIds":["%s#B3"]}],
                 "reviewReason":null,"blockedRules":[],"calls":[]}
                """.formatted(FACILITY, ANNUAL)));
        String block = ANNUAL + "#B3";
        AI.on(STEPS, twoSteps(call("get_outlook", "{}"), request -> finalAnswer(
                "회사는 평택 신규 라인 증설을 2026년까지 완료할 계획이라고 밝혔어요[" + block + "].", "\"" + block + "\"")));

        ResultActions result = chat("회사가 밝힌 계획은?");
        String sent = AI.requests(STEPS).get(1).bodyText();
        assertThat(JsonPath.<List<String>>read(sent, "$.toolResults[0].items[*].text")).first().asString()
                .contains("원문: " + FACILITY);
        assertThat(JsonPath.<List<String>>read(sent, "$.toolResults[0].items[*].evidenceId")).containsExactly(block);
        result
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ANSWERED"))
                .andExpect(jsonPath("$.citations[0].kind").value("BLOCK"))
                .andExpect(jsonPath("$.citations[0].evidenceId").value(block))
                .andExpect(jsonPath("$.citations[0].rceptNo").value(ANNUAL))
                .andExpect(jsonPath("$.citations[0].sectionNo").value(3))
                .andExpect(jsonPath("$.citations[0].blockNo").value(3))
                .andExpect(jsonPath("$.citations[0].quote").value(FACILITY))
                // 이 분석의 두 보고서가 아닌 원문이라 원문 확인 탭의 쪽(side)이 없다
                .andExpect(jsonPath("$.citations[0].side").doesNotExist());
    }

    @Test
    @DisplayName("같은 보고서 쌍의 끝난 분석이 있으면 분석 목록을 보고서 근거(D{접수번호})로 넘기고, 완료된 분석만 열기 액션으로 남긴다(AC18)")
    void existingAnalysisOpensWithOpenAnalysis() throws Exception {
        String evidence = "D" + CUR;
        AI.on(STEPS, twoSteps(call("find_analyses", "{}"), request -> finalAnswer(
                "이미 끝난 전년 동기 비교 분석이 있어요[" + evidence + "].", "\"" + evidence + "\"",
                "{\"type\":\"OPEN_ANALYSIS\",\"analysisId\":" + analysisId + "},"
                        + "{\"type\":\"OPEN_ANALYSIS\",\"analysisId\":999999}")));

        ResultActions result = chat("작년 반기와 비교한 분석 있어?");
        String sent = AI.requests(STEPS).get(1).bodyText();
        assertThat(JsonPath.<List<String>>read(sent, "$.toolResults[0].items[*].text")).first().asString()
                .contains("analysisId " + analysisId, PREV, CUR);
        result.andExpect(jsonPath("$.status").value("ANSWERED"))
                .andExpect(jsonPath("$.citations[0].kind").value("DISCLOSURE"))
                .andExpect(jsonPath("$.citations[0].rceptNo").value(CUR))
                .andExpect(jsonPath("$.citations[0].reportName").value("반기보고서 (2026.06)"))
                .andExpect(jsonPath("$.actions", org.hamcrest.Matchers.hasSize(1)))
                .andExpect(jsonPath("$.actions[0].type").value("OPEN_ANALYSIS"))
                .andExpect(jsonPath("$.actions[0].analysisId").value(analysisId))
                .andExpect(jsonPath("$.actions[0].label").value("이 분석 열기"));
    }

    @Test
    @DisplayName("이 채팅에서 같은 네 값으로 비교할 수 있다고 나왔고 같은 쌍의 끝난 분석이 없을 때만 분석 요청 확인 버튼을 남기고, 값이 다르거나 검증하지 않았으면 뺀다(AC18)")
    void requestAnalysisNeedsComparableCheckInThisChat() throws Exception {
        reportRepository.save(Report.create(Q1, CORP, "분기보고서 (2026.03)",
                new ParsedReportName(ReportType.Q1, 2026, LocalDate.of(2026, 3, 31), Correction.ORIGINAL),
                LocalDate.of(2026, 5, 15), null, "예시전자", NOW));
        DART.on("/api/fnlttSinglAcntAll.json", statement(CUR), statement(Q1));
        String request = "{\"type\":\"CONFIRM_REQUEST_ANALYSIS\",\"corpCode\":\"" + CORP
                + "\",\"previousRceptNo\":\"" + Q1 + "\",\"currentRceptNo\":\"" + CUR + "\",\"basis\":\"%s\"}";
        AI.on(STEPS, twoSteps(call("check_comparability", "{\"previousRceptNo\":\"" + Q1
                + "\",\"currentRceptNo\":\"" + CUR + "\",\"basis\":\"PREV\"}"), r -> finalAnswer(
                "두 보고서는 비교할 수 있어요[D" + CUR + "].", "\"D" + CUR + "\"",
                request.formatted("PREV") + "," + request.formatted("YOY"))));

        ResultActions result = chat("직전 분기랑 비교 분석해줘");
        List<String> texts = JsonPath.read(AI.requests(STEPS).get(1).bodyText(), "$.toolResults[0].items[*].text");
        assertThat(texts).first().asString().contains("비교할 수 있음");
        assertThat(texts).noneMatch(t -> t.contains("같은 비교의 완료된 분석"));
        result.andExpect(jsonPath("$.status").value("ANSWERED"))
                .andExpect(jsonPath("$.actions", org.hamcrest.Matchers.hasSize(1)))
                .andExpect(jsonPath("$.actions[0].type").value("CONFIRM_REQUEST_ANALYSIS"))
                .andExpect(jsonPath("$.actions[0].basis").value("PREV"))
                .andExpect(jsonPath("$.actions[0].label").value("이 비교로 분석 요청"));

        AI.clear();
        AI.on(STEPS, twoSteps(call("find_analyses", "{}"), r -> finalAnswer("분석이 있어요[D" + CUR + "].",
                "\"D" + CUR + "\"", request.formatted("PREV"))));
        chat("직전 분기랑 비교 분석해줘").andExpect(jsonPath("$.actions", org.hamcrest.Matchers.hasSize(0)));
    }

    @Test
    @DisplayName("같은 보고서 쌍의 끝난 분석이 있으면 비교 가능성 결과에 그 분석을 알려 주고, 비교할 수 있어도 분석 요청 확인 버튼을 뺀다(AC18)")
    void requestAnalysisIsDroppedWhenSamePairIsCompleted() throws Exception {
        DART.on("/api/fnlttSinglAcntAll.json", statement(CUR), statement(PREV));
        String request = "{\"type\":\"CONFIRM_REQUEST_ANALYSIS\",\"corpCode\":\"" + CORP
                + "\",\"previousRceptNo\":\"" + PREV + "\",\"currentRceptNo\":\"" + CUR + "\",\"basis\":\"YOY\"}";
        AI.on(STEPS, twoSteps(call("check_comparability", "{\"previousRceptNo\":\"" + PREV
                + "\",\"currentRceptNo\":\"" + CUR + "\",\"basis\":\"YOY\"}"), r -> finalAnswer(
                "이미 끝난 분석이 있어요[D" + CUR + "].", "\"D" + CUR + "\"",
                request + ",{\"type\":\"OPEN_ANALYSIS\",\"analysisId\":" + analysisId + "}")));

        ResultActions result = chat("작년 반기랑 비교 분석해줘");
        assertThat(JsonPath.<List<String>>read(AI.requests(STEPS).get(1).bodyText(), "$.toolResults[0].items[*].text"))
                .anyMatch(t -> t.contains("같은 비교의 완료된 분석 analysisId " + analysisId));
        result.andExpect(jsonPath("$.actions", org.hamcrest.Matchers.hasSize(1)))
                .andExpect(jsonPath("$.actions[0].type").value("OPEN_ANALYSIS"))
                .andExpect(jsonPath("$.actions[0].analysisId").value(analysisId));
    }

    @Test
    @DisplayName("기업 나란히 보기는 기업 목록에 있는 고유번호만 겹치지 않게 남기고, 2곳 미만이면 뺀다(AC27)")
    void companyCompareKeepsKnownCompaniesOnly() throws Exception {
        AI.on(STEPS, twoSteps(call("search_companies", "{\"query\":\"예시전자\"}"), r -> finalAnswer(
                "예시전자와 예시전자서비스를 나란히 볼 수 있어요[C" + CORP + "].", "\"C" + CORP + "\"",
                "{\"type\":\"OPEN_COMPANY_COMPARE\",\"corpCodes\":[\"" + CORP + "\",\"00000002\",\"99999999\",\""
                        + CORP + "\"]},{\"type\":\"OPEN_COMPANY_COMPARE\",\"corpCodes\":[\"" + CORP
                        + "\",\"99999999\"]}")));

        chat("예시전자랑 예시전자서비스 비교해줘")
                .andExpect(jsonPath("$.actions", org.hamcrest.Matchers.hasSize(1)))
                .andExpect(jsonPath("$.actions[0].type").value("OPEN_COMPANY_COMPARE"))
                .andExpect(jsonPath("$.actions[0].corpCodes", org.hamcrest.Matchers.contains(CORP, "00000002")));
    }

    private static Response statement(String rceptNo) {
        return Response.json(FinancialJson.ok(account(rceptNo, "BS", "ifrs-full_Assets", "자산총계", 1, "5000")));
    }

    /** '사업의 내용' 아래 생산설비 목차와 '이사의 경영진단' 대목차가 있는 구조화 결과(OutlookApiTest와 같음) */
    private static String structured() {
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
                   "blocks":[{"blockNo":5,"type":"PARAGRAPH","text":"%4$s%2$s"}]}
                 ]}
                """.formatted(ANNUAL, LONG, FACILITY, MARKET);
    }
}
