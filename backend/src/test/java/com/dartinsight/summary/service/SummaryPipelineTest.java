package com.dartinsight.summary.service;

import static com.dartinsight.dart.client.FinancialJson.account;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dartinsight.aiserver.client.FakeAiServer;
import com.dartinsight.aiserver.client.FakeAiServer.Reply;
import com.dartinsight.aiserver.client.FakeAiServer.Request;
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
import com.dartinsight.summary.repository.SummaryStore;
import com.dartinsight.support.TestData;
import com.dartinsight.support.TestDocuments;
import com.jayway.jsonpath.JsonPath;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
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

/**
 * 근거 기반 요약(3.2)을 분석 실행 전체로 확인한다: 재무제표·원문(가짜 OpenDART) → 구조화·문장 비교·요약(가짜 AI 서버)
 * → 결과 저장 → GET /api/analyses/{id}/summary.
 */
@SpringBootTest
@AutoConfigureMockMvc
class SummaryPipelineTest {

    static final FakeOpenDartServer DART = startDart();
    static final FakeAiServer AI = new FakeAiServer();
    static final String STATEMENTS = "/api/fnlttSinglAcntAll.json";
    static final String DOCUMENT = "/api/document.xml";
    static final String SUMMARIES = "/internal/summaries";
    static final String CUR = "20260814000001";
    static final String PREV = "20250814000001";
    static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 21, 9, 0);

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
    private MockMvc mockMvc;

    @Autowired
    private CompanyImportService companyImportService;

    @Autowired
    private ReportRepository reportRepository;

    @Autowired
    private SummaryStore summaryStore;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        TestData.clearAll(jdbcTemplate);
        TestDocuments.clearCache();
        AI.clear();
        companyImportService.save(List.of(
                new CorpCodeEntry("00000001", "예시전자", null, "900001", LocalDate.of(2026, 1, 1))));
        for (int year : new int[] {2025, 2026}) {
            reportRepository.save(Report.create(year == 2026 ? CUR : PREV, "00000001", "반기보고서 (" + year + ".06)",
                    new ParsedReportName(ReportType.HALF, year, LocalDate.of(year, 6, 30), Correction.ORIGINAL),
                    LocalDate.of(year, 8, 14), null, "예시전자", NOW));
        }
        DART.on(STATEMENTS,
                Response.json(FinancialJson.ok(account(CUR, "BS", "ifrs-full_Assets", "자산총계", 1, "1153"),
                        account(CUR, "IS", "ifrs-full_Revenue", "매출액", 1, "40", "70"))),
                Response.json(FinancialJson.ok(account(PREV, "BS", "ifrs-full_Assets", "자산총계", 1, "1000"),
                        account(PREV, "IS", "ifrs-full_Revenue", "매출액", 1, "30", "55"))));
        DART.on(DOCUMENT, Response.zip(TestDocuments.zip(CUR)));
        AI.on("/internal/documents/parser", Reply.ok("{\"parserVersion\":\"dart-xml-1\"}"));
        AI.on("/internal/documents/" + PREV + "/structure", Reply.ok(document(PREV, "당사는 메모리를 만듭니다.",
                "매출액은 줄었습니다.")));
        AI.on("/internal/documents/" + CUR + "/structure", Reply.ok(document(CUR, "당사는 메모리와 파운드리를 만듭니다.",
                "매출액은 메모리 수요 회복으로 늘었습니다.")));
        AI.on("/internal/text-changes", Reply.ok("""
                {"diffVersion":"text-diff-1","priorityVersion":"priority-1","changes":[
                 {"changeType":"MODIFIED","blockType":"PARAGRAPH","sectionStatus":"MATCHED",
                  "sectionTitle":"1. 사업의 개요","sectionPath":"II. 사업의 내용 > 1. 사업의 개요",
                  "previous":{"sectionNo":2,"blockNo":1},"current":{"sectionNo":2,"blockNo":1},
                  "numbersOnly":false,"similarity":0.7,"reviewReason":null,
                  "priority":{"level":"MEDIUM","score":50,"reasons":["사업의 내용 섹션 +30"]}}
                ]}
                """));
    }

    /** 사업의 개요(섹션 2)와 경영진단(섹션 3)이 있는 구조화 원문 */
    private static String document(String rceptNo, String business, String explanation) {
        return """
                {"rceptNo":"%s","parserVersion":"dart-xml-1","status":"STRUCTURED","mainFile":"%s.xml",
                 "warnings":[],"counts":{"cells":0,"sourceCells":0},
                 "sections":[
                  {"sectionNo":1,"parentNo":null,"level":1,"title":"II. 사업의 내용","cover":false,"blocks":[]},
                  {"sectionNo":2,"parentNo":1,"level":2,"title":"1. 사업의 개요","cover":false,"blocks":[
                    {"blockNo":1,"type":"PARAGRAPH","text":"%s"}]},
                  {"sectionNo":3,"parentNo":null,"level":1,"title":"IV. 이사의 경영진단 및 분석의견","cover":false,
                   "blocks":[{"blockNo":2,"type":"PARAGRAPH","text":"%s"}]}
                 ]}
                """.formatted(rceptNo, rceptNo, business, explanation);
    }

    /** 매출액 설명: 회사가 직접 밝힘(STATED), 경영진단 문단(B2)을 인용 */
    private static final String STATED_REVENUE = """
            "status":"OK","explanation":"회사는 메모리 수요 회복으로 매출이 늘었다고 적었어요.","evidenceIds":["%s#B2"],
            "grade":"STATED","quote":"매출액은 메모리 수요 회복으로 늘었습니다","quoteEvidenceId":"%s#B2\"""".formatted(CUR, CUR);

    /** 요청에 담긴 ref로 답하는 가짜 요약. textStatus는 문장 변화 항목의 상태(OK, REVIEW_NEEDED, BLOCKED) */
    private static Function<Request, Reply> summaryReply(String textStatus) {
        return summaryReply(textStatus, STATED_REVENUE);
    }

    /** revenue는 매출액 항목의 ref·kind를 뺀 JSON 필드 */
    private static Function<Request, Reply> summaryReply(String textStatus, String revenueFields) {
        return request -> {
            String body = request.bodyText();
            String text = JsonPath.<List<String>>read(body, "$.textItems[*].ref").getFirst();
            String revenue = JsonPath.<List<String>>read(body, "$.financialItems[?(@.accountName=='매출액')].ref")
                    .getFirst();
            String assets = JsonPath.<List<String>>read(body, "$.financialItems[?(@.accountName=='자산총계')].ref")
                    .getFirst();
            String textItem = switch (textStatus) {
                case "OK" -> """
                      {"ref":"%s","kind":"TEXT","status":"OK","sentence":"사업의 개요에 파운드리가 더해졌어요.",
                       "explanation":null,"evidenceIds":["%s#B1"],"reviewReason":null}""".formatted(text, CUR);
                case "BLOCKED" -> """
                      {"ref":"%s","kind":"TEXT","status":"REVIEW_NEEDED","sentence":null,"explanation":null,
                       "evidenceIds":[],"reviewReason":"투자 권유로 읽힐 수 있는 표현(목표주가)이 있어 내보내지 않았어요.",
                       "blockedRules":["TARGET_PRICE"]}""".formatted(text);
                default -> """
                      {"ref":"%s","kind":"TEXT","status":"REVIEW_NEEDED","sentence":null,"explanation":null,
                       "evidenceIds":[],"reviewReason":"원문에 없는 숫자(3)를 썼어요.","blockedRules":[]}""".formatted(text);
            };
            return Reply.ok("""
                    {"promptVersion":"summary-1","model":"fake-model","generatedAt":"2026-10-22T09:00:00","items":[
                     %s,
                     {"ref":"%s","kind":"FINANCIAL","sentence":null,%s},
                     {"ref":"%s","kind":"FINANCIAL","status":"OK","sentence":null,"explanation":null,"evidenceIds":[],
                      "grade":"NONE","quote":null,"quoteEvidenceId":null}
                    ],"calls":[{"task":"summary","provider":"fake","model":"fake-model","promptVersion":"summary-1",
                      "calledAt":"2026-10-22T09:00:00","traceId":"trace-summary","inputTokens":120,"outputTokens":40,
                      "latencyMs":15,"attempt":1,"outcome":"OK","error":null}]}
                    """.formatted(textItem, revenue, revenueFields, assets));
        };
    }

    private long analyze() throws Exception {
        String body = mockMvc.perform(post("/api/analyses").contentType(MediaType.APPLICATION_JSON)
                        .header("X-Trace-Id", "trace-summary")
                        .content("""
                                {"corpCode":"00000001","currentRceptNo":"%s","previousRceptNo":"%s","basis":"YOY"}
                                """.formatted(CUR, PREV)))
                .andExpect(status().isAccepted())
                .andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(body, "$.analysisId")).longValue();
    }

    @Test
    void summaryIsSavedWithTheResultAndEvidenceOpensInTheApp() throws Exception {
        AI.on(SUMMARIES, summaryReply("OK"));

        long id = analyze();

        mockMvc.perform(get("/api/analyses/{id}", id))
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.summaryStatus").value("COMPLETED"));
        mockMvc.perform(get("/api/analyses/{id}/summary", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summaryStatus").value("COMPLETED"))
                .andExpect(jsonPath("$.textStatus").value("COMPLETED"))
                .andExpect(jsonPath("$.reviewNeededCount").value(0))
                .andExpect(jsonPath("$.items", hasSize(3)))
                .andExpect(jsonPath("$.items[0].kind").value("TEXT"))
                .andExpect(jsonPath("$.items[0].target.type").value("TEXT"))
                .andExpect(jsonPath("$.items[0].target.changeId").isNumber())
                .andExpect(jsonPath("$.items[0].aiText").value("사업의 개요에 파운드리가 더해졌어요."))
                .andExpect(jsonPath("$.items[0].aiGenerated").value(true))
                .andExpect(jsonPath("$.items[0].ai.model").value("fake-model"))
                .andExpect(jsonPath("$.items[0].ai.promptVersion").value("summary-1"))
                .andExpect(jsonPath("$.items[0].ai.generatedAt").value("2026-10-22T09:00:00"))
                .andExpect(jsonPath("$.items[0].evidence[0].evidenceId").value(CUR + "#B1"))
                .andExpect(jsonPath("$.items[0].evidence[0].side").value("current"))
                .andExpect(jsonPath("$.items[0].evidence[0].sectionNo").value(2))
                .andExpect(jsonPath("$.items[0].evidence[0].blockNo").value(1))
                .andExpect(jsonPath("$.items[1].kind").value("FINANCIAL"))
                .andExpect(jsonPath("$.items[1].target.type").value("FINANCIAL"))
                .andExpect(jsonPath("$.items[1].target.sjDiv").value("IS"))
                .andExpect(jsonPath("$.items[1].factSentence").value("매출액이 55 원에서 70 원으로 늘었어요(+27.3%)."))
                .andExpect(jsonPath("$.items[1].explanationStatus").value("FOUND"))
                .andExpect(jsonPath("$.items[1].explanationGrade").value("STATED"))
                .andExpect(jsonPath("$.items[1].quote").value("매출액은 메모리 수요 회복으로 늘었습니다"))
                .andExpect(jsonPath("$.items[1].quoteEvidence.evidenceId").value(CUR + "#B2"))
                .andExpect(jsonPath("$.items[1].quoteEvidence.side").value("current"))
                .andExpect(jsonPath("$.items[1].quoteEvidence.sectionNo").value(3))
                .andExpect(jsonPath("$.items[1].quoteEvidence.blockNo").value(2))
                .andExpect(jsonPath("$.items[1].gradeReason").doesNotExist())
                .andExpect(jsonPath("$.items[1].evidence[0].sectionNo").value(3))
                .andExpect(jsonPath("$.items[2].factSentence").value("자산총계가 1,000 원에서 1,153 원으로 늘었어요(+15.3%)."))
                .andExpect(jsonPath("$.items[2].explanationStatus").value("NOT_FOUND"))
                .andExpect(jsonPath("$.items[2].explanationGrade").value("NONE"))
                .andExpect(jsonPath("$.items[2].quote").doesNotExist())
                .andExpect(jsonPath("$.items[2].gradeReason").doesNotExist())
                .andExpect(jsonPath("$.items[2].aiGenerated").value(false))
                .andExpect(jsonPath("$.items[2].ai").doesNotExist());

        Request sent = AI.requests(SUMMARIES).getFirst();
        assertThat(sent.traceId()).isEqualTo("trace-summary");
        assertThat(sent.bodyText()).contains("\"companyName\":\"예시전자\"")
                .contains(PREV + "#B1").contains(CUR + "#B1").contains("매출액은 메모리 수요 회복으로 늘었습니다.");
        // 설명 후보는 AI 서버가 찾도록 현재 보고서 문단을 모두 보내고, 후보를 골라 보내지 않는다(ADR-0036)
        assertThat(JsonPath.<List<String>>read(sent.bodyText(), "$.documentBlocks[*].evidenceId"))
                .containsExactly(CUR + "#B1", CUR + "#B2");
        assertThat(sent.bodyText()).doesNotContain("\"candidates\"");
        // 설명 후보 검색어는 표준계정 ID 사전에서 나온 것까지 함께 보낸다(ADR-0015)
        assertThat(JsonPath.<List<List<String>>>read(sent.bodyText(),
                "$.financialItems[?(@.accountName=='매출액')].accountAliases")).containsExactly(List.of("매출액", "영업수익"));
        assertThat(JsonPath.<List<List<String>>>read(sent.bodyText(),
                "$.financialItems[?(@.accountName=='자산총계')].accountAliases"))
                .containsExactly(List.of("자산총계", "자산총액", "총자산"));
        assertThat(summaryStore.calls(id)).singleElement().satisfies(call -> {
            assertThat(call.model()).isEqualTo("fake-model");
            assertThat(call.inputTokens()).isEqualTo(120);
            assertThat(call.outcome()).isEqualTo("OK");
        });
    }

    @Test
    void itemsThatFailedTheirChecksAreCountedAsReviewNeeded() throws Exception {
        AI.on(SUMMARIES, summaryReply("REVIEW_NEEDED"));

        long id = analyze();

        mockMvc.perform(get("/api/analyses/{id}/summary", id))
                .andExpect(jsonPath("$.summaryStatus").value("PARTIAL"))
                .andExpect(jsonPath("$.summaryMessage").isNotEmpty())
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.reviewNeededCount").value(1))
                .andExpect(jsonPath("$.reviewNeeded[0].kind").value("TEXT"))
                .andExpect(jsonPath("$.reviewNeeded[0].target.changeId").isNumber())
                .andExpect(jsonPath("$.reviewNeeded[0].reason").value("원문에 없는 숫자(3)를 썼어요."))
                .andExpect(jsonPath("$.reviewNeeded[0].blockedRules", hasSize(0)));
    }

    @Test
    void sentencesBlockedByTheExpressionCheckAreNeverShown() throws Exception {
        AI.on(SUMMARIES, summaryReply("BLOCKED"));

        long id = analyze();

        mockMvc.perform(get("/api/analyses/{id}/summary", id))
                .andExpect(jsonPath("$.summaryStatus").value("PARTIAL"))
                .andExpect(jsonPath("$.items[?(@.kind == 'TEXT')]", hasSize(0)))
                .andExpect(jsonPath("$.reviewNeededCount").value(1))
                .andExpect(jsonPath("$.reviewNeeded[0].blockedRules[0]").value("TARGET_PRICE"))
                .andExpect(jsonPath("$.reviewNeeded[0].reason").value(containsString("투자 권유")));
        assertThat(summaryStore.items(id)).filteredOn(i -> "TEXT".equals(i.row().kind())).singleElement()
                .satisfies(i -> assertThat(i.row().blockedRules()).containsExactly("TARGET_PRICE"));
    }

    @Test
    void withoutDocumentsOnlyCodeMadeFactsAreShownAndTheLlmIsNotCalled() throws Exception {
        DART.on(DOCUMENT, Response.xml("<result><status>014</status><message>파일이 존재하지 않습니다.</message></result>"));
        AI.on(SUMMARIES, Reply.error(503, "AI_LLM_UNAVAILABLE", "AI 모델을 쓸 수 없어요."));

        long id = analyze();

        mockMvc.perform(get("/api/analyses/{id}/summary", id))
                .andExpect(jsonPath("$.summaryStatus").value("COMPLETED"))
                .andExpect(jsonPath("$.textStatus").value("FAILED"))
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.items[0].factSentence").isNotEmpty())
                .andExpect(jsonPath("$.items[0].explanationStatus").value("NOT_FOUND"))
                .andExpect(jsonPath("$.items[0].explanationGrade").value("NONE"))
                .andExpect(jsonPath("$.items[0].aiGenerated").value(false));
        assertThat(AI.requests(SUMMARIES)).isEmpty();
        assertThat(summaryStore.calls(id)).isEmpty();
    }

    @Test
    @DisplayName("코드가 등급을 NONE으로 낮춘 설명은 '확인된 설명 없음'으로 두고 낮춘 사유를 함께 준다")
    void explanationDowngradedToNoneKeepsTheReason() throws Exception {
        AI.on(SUMMARIES, summaryReply("OK", """
                "status":"OK","explanation":null,"evidenceIds":[],"grade":"NONE","quote":null,"quoteEvidenceId":null,
                "reviewReason":"인용문이 후보 원문에 그대로 없어 설명으로 쓰지 않았어요.\""""));

        long id = analyze();

        mockMvc.perform(get("/api/analyses/{id}/summary", id))
                .andExpect(jsonPath("$.summaryStatus").value("COMPLETED"))
                .andExpect(jsonPath("$.reviewNeededCount").value(0))
                .andExpect(jsonPath("$.items[1].explanationStatus").value("NOT_FOUND"))
                .andExpect(jsonPath("$.items[1].explanationGrade").value("NONE"))
                .andExpect(jsonPath("$.items[1].aiText").doesNotExist())
                .andExpect(jsonPath("$.items[1].quoteEvidence").doesNotExist())
                .andExpect(jsonPath("$.items[1].gradeReason").value("인용문이 후보 원문에 그대로 없어 설명으로 쓰지 않았어요."))
                .andExpect(jsonPath("$.items[2].gradeReason").doesNotExist());
    }

    @Test
    @DisplayName("코드가 RELATED로 낮춘 설명은 관련 내용으로 보이고 낮춘 사유를 함께 준다")
    void explanationDowngradedToRelatedIsShownWithTheReason() throws Exception {
        AI.on(SUMMARIES, summaryReply("OK", """
                "status":"OK","explanation":"경영진단에 메모리 수요 회복이 적혀 있어요.","evidenceIds":["%s#B2"],
                "grade":"RELATED","quote":"메모리 수요 회복","quoteEvidenceId":"%s#B2",
                "reviewReason":"인용문에 계정 이름이 없어 '관련 내용'으로 낮췄어요.\"""".formatted(CUR, CUR)));

        long id = analyze();

        mockMvc.perform(get("/api/analyses/{id}/summary", id))
                .andExpect(jsonPath("$.reviewNeededCount").value(0))
                .andExpect(jsonPath("$.items[1].explanationStatus").value("FOUND"))
                .andExpect(jsonPath("$.items[1].explanationGrade").value("RELATED"))
                .andExpect(jsonPath("$.items[1].quote").value("메모리 수요 회복"))
                .andExpect(jsonPath("$.items[1].quoteEvidence.blockNo").value(2))
                .andExpect(jsonPath("$.items[1].gradeReason").value("인용문에 계정 이름이 없어 '관련 내용'으로 낮췄어요."));
        assertThat(summaryStore.items(id)).filteredOn(i -> "FINANCIAL".equals(i.row().kind())).first()
                .satisfies(i -> {
                    assertThat(i.row().explanationGrade()).isEqualTo("RELATED");
                    assertThat(i.row().quoteEvidenceId()).isEqualTo(CUR + "#B2");
                });
    }

    @Test
    @DisplayName("인용 위치가 보낸 후보가 아니거나 등급이 없는 설명은 보이지 않고 템플릿으로 바꿔 검토 필요로 센다")
    void explanationWithoutAValidQuoteIsReviewNeeded() throws Exception {
        AI.on(SUMMARIES, summaryReply("OK", """
                "status":"OK","explanation":"회사는 메모리 수요 회복으로 매출이 늘었다고 적었어요.","evidenceIds":["%s#B2"],
                "grade":"STATED","quote":"매출액은 메모리 수요 회복으로 늘었습니다","quoteEvidenceId":"20990101000001#B2\"""".formatted(CUR)));

        long id = analyze();

        mockMvc.perform(get("/api/analyses/{id}/summary", id))
                .andExpect(jsonPath("$.summaryStatus").value("PARTIAL"))
                .andExpect(jsonPath("$.items[1].explanationStatus").value("TEMPLATE"))
                .andExpect(jsonPath("$.items[1].explanationGrade").doesNotExist())
                .andExpect(jsonPath("$.items[1].aiText").doesNotExist())
                .andExpect(jsonPath("$.items[1].gradeReason").doesNotExist())
                .andExpect(jsonPath("$.reviewNeededCount").value(1))
                .andExpect(jsonPath("$.reviewNeeded[0].reason").value(containsString("인용 위치")));
    }

    @Test
    @DisplayName("설명의 근거가 아닌 곳을 인용한 설명은 보이지 않고 그 인용도 템플릿에 쓰지 않는다")
    void explanationQuotingOutsideItsEvidenceIsReviewNeeded() throws Exception {
        // 사업의 개요(B1)에도 매출액이 있어 후보가 B1·B2 둘이다. 설명은 B2를 근거로 들고 인용은 B1에서 가져온다
        AI.on("/internal/documents/" + CUR + "/structure", Reply.ok(document(CUR, "당사의 매출액은 메모리에서 나옵니다.",
                "매출액은 메모리 수요 회복으로 늘었습니다.")));
        AI.on(SUMMARIES, summaryReply("OK", """
                "status":"OK","explanation":"회사는 메모리 수요 회복으로 매출이 늘었다고 적었어요.","evidenceIds":["%s#B2"],
                "grade":"STATED","quote":"당사의 매출액은 메모리에서 나옵니다","quoteEvidenceId":"%s#B1\"""".formatted(CUR, CUR)));

        long id = analyze();

        mockMvc.perform(get("/api/analyses/{id}/summary", id))
                .andExpect(jsonPath("$.items[1].explanationStatus").value("TEMPLATE"))
                .andExpect(jsonPath("$.items[1].quote").doesNotExist())
                .andExpect(jsonPath("$.reviewNeeded[0].reason").value(containsString("인용 위치")));
    }

    @Test
    @DisplayName("다시 만들어도 검증을 통과하지 못한 설명은 템플릿으로 바꾸고, 원문에서 확인한 인용만 회사 설명으로 보인다")
    void explanationFailingAfterRetriesIsShownAsATemplateWithTheCheckedQuote() throws Exception {
        AI.on(SUMMARIES, summaryReply("OK", """
                "status":"REVIEW_NEEDED","explanation":null,"evidenceIds":[],"grade":null,
                "reviewReason":"원인 표현('로 인해')은 회사가 원인을 직접 밝힌(STATED) 설명에만 씁니다.",
                "quote":"매출액은 메모리 수요 회복으로 늘었습니다","quoteEvidenceId":"%s#B2\"""".formatted(CUR)));

        long id = analyze();

        mockMvc.perform(get("/api/analyses/{id}/summary", id))
                .andExpect(jsonPath("$.summaryStatus").value("PARTIAL"))
                .andExpect(jsonPath("$.items[1].factSentence").isNotEmpty())
                .andExpect(jsonPath("$.items[1].explanationStatus").value("TEMPLATE"))
                .andExpect(jsonPath("$.items[1].aiText").doesNotExist())
                .andExpect(jsonPath("$.items[1].aiGenerated").value(false))
                .andExpect(jsonPath("$.items[1].ai").doesNotExist())
                .andExpect(jsonPath("$.items[1].explanationGrade").doesNotExist())
                .andExpect(jsonPath("$.items[1].gradeReason").doesNotExist())
                .andExpect(jsonPath("$.items[1].quote").value("매출액은 메모리 수요 회복으로 늘었습니다"))
                .andExpect(jsonPath("$.items[1].quoteEvidence.side").value("current"))
                .andExpect(jsonPath("$.items[1].quoteEvidence.blockNo").value(2))
                .andExpect(jsonPath("$.reviewNeededCount").value(1))
                .andExpect(jsonPath("$.reviewNeeded[0].reason").value(containsString("원문 인용만 보여 줘요")));
    }

    @Test
    @DisplayName("템플릿의 인용 위치가 보낸 후보가 아니면 인용 없이 '확인된 설명 없음' 자리로 둔다")
    void templateQuoteOutsideTheCandidatesIsDropped() throws Exception {
        AI.on(SUMMARIES, summaryReply("OK", """
                "status":"REVIEW_NEEDED","explanation":null,"evidenceIds":[],"grade":null,
                "reviewReason":"다시 생성해도 근거·숫자 확인을 통과하지 못했어요.",
                "quote":"매출액은 메모리 수요 회복으로 늘었습니다","quoteEvidenceId":"20990101000001#B2\""""));

        long id = analyze();

        mockMvc.perform(get("/api/analyses/{id}/summary", id))
                .andExpect(jsonPath("$.items[1].explanationStatus").value("TEMPLATE"))
                .andExpect(jsonPath("$.items[1].quote").doesNotExist())
                .andExpect(jsonPath("$.items[1].quoteEvidence").doesNotExist())
                .andExpect(jsonPath("$.reviewNeeded[0].reason").value(containsString("설명의 근거를 확인하지 못했어요.")));
    }

    @Test
    void answersCitingSourcesThatWereNotSentAreNotShown() throws Exception {
        AI.on(SUMMARIES, request -> {
            String body = request.bodyText();
            String text = JsonPath.<List<String>>read(body, "$.textItems[*].ref").getFirst();
            // 문장 변화는 보내지 않은 원문을 근거로 들고, 같은 항목이 두 번 오고, 재무 항목(매출액·자산총계)은 빠진 응답
            return Reply.ok("""
                    {"promptVersion":"summary-1","model":"fake-model","generatedAt":"2026-10-22T09:00:00","items":[
                     {"ref":"%s","kind":"TEXT","status":"OK","sentence":"다른 보고서 내용","evidenceIds":["%s#B1"]},
                     {"ref":"%s","kind":"TEXT","status":"OK","sentence":"두 번째","evidenceIds":["%s#B1"]}
                    ],"calls":[]}
                    """.formatted(text, "20990101000001", text, CUR));
        });

        long id = analyze();

        mockMvc.perform(get("/api/analyses/{id}/summary", id))
                .andExpect(jsonPath("$.summaryStatus").value("PARTIAL"))
                .andExpect(jsonPath("$.items[?(@.kind == 'TEXT')]", hasSize(0)))
                .andExpect(jsonPath("$.items[0].factSentence").isNotEmpty())
                .andExpect(jsonPath("$.items[0].explanationStatus").value("TEMPLATE"))
                // 후보는 AI 서버가 고르고 재무 항목마다 늘 답하므로(후보가 없으면 NONE), 빠진 항목은 검토 필요다(ADR-0036)
                .andExpect(jsonPath("$.items[1].explanationStatus").value("TEMPLATE"))
                .andExpect(jsonPath("$.reviewNeededCount").value(3));
        assertThat(summaryStore.items(id)).hasSize(3);
    }

    @Test
    void emptySummaryAnswerFailsWithTheSummaryCode() throws Exception {
        AI.on(SUMMARIES, Reply.ok("{\"items\":null}"));

        long id = analyze();

        mockMvc.perform(get("/api/analyses/{id}", id))
                .andExpect(jsonPath("$.status").value("FAILED"))
                .andExpect(jsonPath("$.error.code").value("ANALYSIS_SUMMARY_FAILED"));
    }

    @Test
    void unavailableLlmFailsTheAnalysisInsteadOfCompletingWithoutSummary() throws Exception {
        AI.on(SUMMARIES, Reply.error(503, "AI_LLM_UNAVAILABLE", "AI 모델을 쓸 수 없어요."));

        long id = analyze();

        mockMvc.perform(get("/api/analyses/{id}", id))
                .andExpect(jsonPath("$.status").value("FAILED"))
                .andExpect(jsonPath("$.error.code").value("ANALYSIS_SUMMARY_FAILED"))
                .andExpect(jsonPath("$.error.retryable").value(true));
        assertThat(summaryStore.items(id)).isEmpty();
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM financial_change", Integer.class)).isZero();
    }
}
