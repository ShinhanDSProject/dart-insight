package com.dartinsight.agent.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dartinsight.aiserver.client.FakeAiServer;
import com.dartinsight.aiserver.client.FakeAiServer.Reply;
import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.domain.CalcStatus;
import com.dartinsight.analysis.domain.FinancialChangeRow;
import com.dartinsight.analysis.domain.FinancialChangeRow.Evidence;
import com.dartinsight.analysis.domain.TextChangeRow;
import com.dartinsight.analysis.domain.TextChangeRow.Priority;
import com.dartinsight.analysis.domain.TextChangeRow.Side;
import com.dartinsight.analysis.domain.TextComparison;
import com.dartinsight.analysis.domain.TextStatus;
import com.dartinsight.analysis.repository.AnalysisRepository;
import com.dartinsight.analysis.repository.FinancialChangeRepository;
import com.dartinsight.analysis.service.AnalysisResultService;
import com.dartinsight.company.service.CompanyImportService;
import com.dartinsight.comparison.domain.AmountBasis;
import com.dartinsight.comparison.domain.ComparisonBasis;
import com.dartinsight.dart.domain.CorpCodeEntry;
import com.dartinsight.document.domain.ReportDocument;
import com.dartinsight.document.dto.StructuredDocumentResponse;
import com.dartinsight.document.dto.StructuredDocumentResponse.Block;
import com.dartinsight.document.dto.StructuredDocumentResponse.Section;
import com.dartinsight.document.repository.DocumentStore;
import com.dartinsight.document.repository.ReportDocumentRepository;
import com.dartinsight.financial.domain.FsDiv;
import com.dartinsight.report.domain.Correction;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.domain.ReportNameParser.ParsedReportName;
import com.dartinsight.report.domain.ReportType;
import com.dartinsight.report.repository.ReportRepository;
import com.dartinsight.note.domain.NoteKind;
import com.dartinsight.note.dto.NoteCreateRequest;
import com.dartinsight.note.service.JudgmentNoteService;
import com.dartinsight.summary.domain.SummaryItemRow;
import com.dartinsight.summary.domain.SummaryResult;
import com.dartinsight.summary.domain.SummaryStatus;
import com.dartinsight.support.TestData;
import com.jayway.jsonpath.JsonPath;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
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

/** AI 에이전트 채팅(ADR-0044): POST /api/analyses/{analysisId}/chat-messages, 가짜 AI 서버(/internal/agent-steps) */
@SpringBootTest
@AutoConfigureMockMvc
class AgentChatApiTest {

    static final FakeAiServer AI = new FakeAiServer();
    static final String STEPS = "/internal/agent-steps";
    static final String CUR = "20260814000001";
    static final String PREV = "20250814000001";
    static final LocalDateTime NOW = LocalDateTime.of(2026, 11, 3, 9, 0);
    static final String CALL = """
            {"task":"%s","provider":"fake","model":"fake-model","promptVersion":"agent-1",
             "calledAt":"2026-11-03T10:12:02","traceId":"trace-agent","inputTokens":100,"outputTokens":20,
             "latencyMs":50,"attempt":1,"outcome":"OK","error":null}
            """;

    @DynamicPropertySource
    static void servers(DynamicPropertyRegistry registry) {
        registry.add("app.ai-server.base-url", AI::baseUrl);
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AnalysisRepository analysisRepository;

    @Autowired
    private AnalysisResultService resultService;

    @Autowired
    private FinancialChangeRepository changeRepository;

    @Autowired
    private ReportDocumentRepository documentRepository;

    @Autowired
    private DocumentStore documentStore;

    @Autowired
    private CompanyImportService companyImportService;

    @Autowired
    private ReportRepository reportRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private JudgmentNoteService noteService;

    private Long analysisId;
    private long lawsuitChangeId;

    @BeforeEach
    void setUp() {
        TestData.clearAll(jdbcTemplate);
        AI.clear();
        companyImportService.save(List.of(
                new CorpCodeEntry("00000001", "예시전자", null, "900001", LocalDate.of(2026, 1, 1))));
        for (int year : new int[] {2025, 2026}) {
            reportRepository.save(Report.create(year == 2026 ? CUR : PREV, "00000001", "반기보고서 (" + year + ".06)",
                    new ParsedReportName(ReportType.HALF, year, LocalDate.of(year, 6, 30), Correction.ORIGINAL),
                    LocalDate.of(year, 8, 14), null, "예시전자", NOW));
        }
        document(CUR);
        document(PREV);
        Analysis analysis = Analysis.request("00000001", CUR, PREV, ComparisonBasis.YOY, null, NOW);
        analysis.start(NOW);
        analysis.recordFsDiv(FsDiv.CFS);
        analysisId = analysisRepository.save(analysis).getId();
        resultService.saveAndComplete(analysisId, List.of(
                new FinancialChangeRow("IS", FsDiv.CFS, "dart_OperatingIncomeLoss", "영업이익", 0,
                        AmountBasis.CUMULATIVE, 6_600_000_000_000L, 4_300_000_000_000L, -2_300_000_000_000L,
                        new BigDecimal("-0.348485"), CalcStatus.OK, "KRW",
                        new Evidence(PREV, "IS", "dart_OperatingIncomeLoss", "영업이익", "제 56 기 반기"),
                        new Evidence(CUR, "IS", "dart_OperatingIncomeLoss", "영업이익", "제 57 기 반기"))),
                new TextComparison(TextStatus.COMPLETED, null, List.of(
                        new TextChangeRow(TextChangeRow.ADDED, "PARAGRAPH", false, "MATCHED", "2. 우발부채 등에 관한 사항",
                                "XI. 그 밖에 투자자 보호를 위하여 필요한 사항 > 2. 우발부채 등에 관한 사항", null,
                                new Side(CUR, 3, 5, "당사는 특허 침해 소송을 제기받았습니다."), null, null,
                                new Priority("HIGH", 70, List.of(), "priority-3")))),
                new SummaryResult(SummaryStatus.COMPLETED, null, List.of(new SummaryItemRow(SummaryItemRow.FINANCIAL,
                        SummaryItemRow.SHOWN, "영업이익이 6.6조 원에서 4.3조 원으로 줄었어요(-34.8%).", "관련 공시 내용으로 소송이 있어요.",
                        SummaryItemRow.FOUND, List.of(CUR + "#B5"), 0, null, null, "summary-model", "summary-2", NOW,
                        List.of(), SummaryItemRow.RELATED, "당사는 특허 침해 소송을 제기받았습니다.", CUR + "#B5")), List.of()));
        lawsuitChangeId = jdbcTemplate.queryForObject("SELECT id FROM text_change WHERE analysis_id = ?", Long.class,
                analysisId);
    }

    private void document(String rceptNo) {
        List<Section> sections = List.of(
                new Section(1, null, 1, "II. 사업의 내용", null, false,
                        List.of(new Block(1, "PARAGRAPH", "사업의 내용 개요입니다.", null))),
                new Section(2, 1, 2, "1. 사업의 개요", null, false,
                        List.of(new Block(2, "PARAGRAPH", "당사는 메모리를 만듭니다.", null))),
                new Section(3, null, 1, "XI. 그 밖에 투자자 보호를 위하여 필요한 사항", null, false, List.of(
                        new Block(5, "PARAGRAPH", "당사는 특허 침해 소송을 제기받았습니다.", null))));
        StructuredDocumentResponse response = new StructuredDocumentResponse(rceptNo, "dart-xml-1", "STRUCTURED",
                null, null, rceptNo + ".xml", "utf-8", "반기보고서", "예시전자", List.of(), List.of(),
                Map.of("cells", 0, "sourceCells", 0), sections);
        ReportDocument saved = documentRepository.save(ReportDocument.structured(rceptNo, response, 100, NOW, NOW));
        documentStore.replace(saved.getId(), sections);
    }

    private ResultActions chat(Long id, String body) throws Exception {
        return mockMvc.perform(post("/api/analyses/{a}/chat-messages", id).header("X-Trace-Id", "trace-agent")
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private ResultActions chat(String message) throws Exception {
        return chat(analysisId, "{\"message\":\"" + message + "\"}");
    }

    private static String toolCalls(String calls) {
        return """
                {"promptVersion":"agent-1","model":"fake-model","generatedAt":"2026-11-03T10:12:03",
                 "type":"TOOL_CALLS","toolCalls":[%s],"final":null,"rejections":[],"calls":[%s]}
                """.formatted(calls, CALL.formatted("agent_plan"));
    }

    private static String finalAnswer(String status, String answer, String evidenceIds, String actions) {
        return """
                {"promptVersion":"agent-1","model":"fake-model","generatedAt":"2026-11-03T10:12:03","type":"FINAL",
                 "toolCalls":[],"final":{"status":"%s","answer":%s,"evidenceIds":[%s],"actions":[%s],
                 "reviewReason":null,"blockedRules":[],"format":"CHAT","crossCheck":null},
                 "rejections":[],"calls":[%s]}
                """.formatted(status, answer == null ? "null" : "\"" + answer + "\"", evidenceIds, actions,
                CALL.formatted("agent_answer"));
    }

    /** 첫 왕복은 calls, 다음 왕복부터는 then으로 답하는 가짜 AI 서버 */
    private static Function<FakeAiServer.Request, Reply> twoSteps(String calls,
            Function<FakeAiServer.Request, String> then) {
        return request -> {
            List<?> results = JsonPath.read(request.bodyText(), "$.toolResults");
            return Reply.ok(results.isEmpty() ? toolCalls(calls) : then.apply(request));
        };
    }

    private int llmCalls() {
        return jdbcTemplate.queryForObject("SELECT COUNT(*) FROM llm_call WHERE analysis_id = ?", Integer.class,
                analysisId);
    }

    @Test
    @DisplayName("메시지가 2자 미만·500자 초과, 대화가 6개 초과, 모르는 탭이면 400이고 AI 서버를 부르지 않는다")
    void rejectsInvalidRequests() throws Exception {
        for (String message : new String[] {"", " 가 ", "가".repeat(501)}) {
            chat(message).andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errors[0].field").value("message"));
        }
        String turn = "{\"role\":\"user\",\"text\":\"질문\"}";
        chat(analysisId, "{\"message\":\"영업이익\",\"history\":[" + String.join(",", List.of(turn, turn, turn,
                turn, turn, turn, turn)) + "]}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("history"));
        chat(analysisId, "{\"message\":\"영업이익\",\"history\":[{\"role\":\"system\",\"text\":\"x\"}]}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("history[0].role"));
        chat(analysisId, "{\"message\":\"영업이익\",\"context\":{\"tab\":\"ask\"}}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("context.tab"));
        assertThat(AI.requests(STEPS)).isEmpty();
    }

    @Test
    @DisplayName("없는 분석은 404, 끝나지 않은 분석은 409")
    void unknownAnalysisIsNotFoundAndUnfinishedIsNotReady() throws Exception {
        chat(999_999L, "{\"message\":\"영업이익\"}").andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ANALYSIS_NOT_FOUND"));
        Long running = analysisRepository.save(
                Analysis.request("00000001", CUR, PREV, ComparisonBasis.PREV, null, NOW)).getId();
        chat(running, "{\"message\":\"영업이익\"}").andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ANALYSIS_NOT_READY"));
        assertThat(AI.requests(STEPS)).isEmpty();
    }

    @Test
    @DisplayName("목록에서 접히는 주석 변경도 채팅의 문장 변경 찾기로 찾는다")
    void searchToolFindsFoldedNoteChanges() throws Exception {
        jdbcTemplate.update("UPDATE text_change SET list_group = 'NOTE', note_scope = 'CONSOLIDATED', "
                + "raised_from_note = FALSE, list_version = 'text-list-1' WHERE analysis_id = ?", analysisId);
        AI.on(STEPS, twoSteps("{\"callId\":\"c1\",\"name\":\"search_text_changes\",\"arguments\":{\"q\":\"소송\"}}",
                request -> finalAnswer("NOT_FOUND", null, "", "")));

        chat("소송 관련 변경 보여줘").andExpect(status().isOk());

        assertThat(JsonPath.<List<String>>read(AI.requests(STEPS).get(1).bodyText(),
                "$.toolResults[0].items[*].evidenceId")).contains("T" + lawsuitChangeId);
    }

    @Test
    @DisplayName("Tool을 실행하고 결과를 붙여 다시 부른 뒤, 근거 칩과 확인한 화면 액션이 붙은 답을 돌려준다")
    void runsToolsAndAnswersWithCitationsAndActions() throws Exception {
        String evidence = "T" + lawsuitChangeId;
        AI.on(STEPS, twoSteps("{\"callId\":\"c1\",\"name\":\"search_text_changes\",\"arguments\":{\"q\":\"소송\"}}",
                request -> finalAnswer("ANSWERED", "소송 관련 변경은 1건이에요[" + evidence + "].",
                        "\"" + evidence + "\"",
                        "{\"type\":\"OPEN_TAB\",\"tab\":\"text\",\"filters\":{\"q\":\"소송\",\"risk\":null}},"
                                + "{\"type\":\"OPEN_TEXT_CHANGE\",\"changeId\":" + lawsuitChangeId + "},"
                                + "{\"type\":\"OPEN_TEXT_CHANGE\",\"changeId\":9999},"
                                + "{\"type\":\"DELETE_POST\",\"postId\":1}")));

        chat("소송 관련 변경 보여줘")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ANSWERED"))
                .andExpect(jsonPath("$.answer").value("소송 관련 변경은 1건이에요[1]."))
                .andExpect(jsonPath("$.citations", hasSize(1)))
                .andExpect(jsonPath("$.citations[0].kind").value("TEXT_CHANGE"))
                .andExpect(jsonPath("$.citations[0].evidenceId").value(evidence))
                .andExpect(jsonPath("$.citations[0].changeId").value(lawsuitChangeId))
                .andExpect(jsonPath("$.citations[0].changeType").value("ADDED"))
                .andExpect(jsonPath("$.citations[0].rceptNo").value(CUR))
                .andExpect(jsonPath("$.citations[0].reportName").value("반기보고서 (2026.06)"))
                .andExpect(jsonPath("$.citations[0].quote").value("당사는 특허 침해 소송을 제기받았습니다."))
                .andExpect(jsonPath("$.actions", hasSize(2)))
                .andExpect(jsonPath("$.actions[0].label").value("문장 변화에서 보기"))
                .andExpect(jsonPath("$.actions[0].filters.q").value("소송"))
                .andExpect(jsonPath("$.actions[0].filters.risk").doesNotExist())
                .andExpect(jsonPath("$.actions[1].type").value("OPEN_TEXT_CHANGE"))
                .andExpect(jsonPath("$.actions[1].label").value("이 변경 보기"))
                .andExpect(jsonPath("$.format").value("CHAT"))
                .andExpect(jsonPath("$.questionId").doesNotExist())
                .andExpect(jsonPath("$.aiGenerated").value(true))
                .andExpect(jsonPath("$.ai.promptVersion").value("agent-1"));

        List<FakeAiServer.Request> requests = AI.requests(STEPS);
        assertThat(requests).hasSize(2);
        assertThat(requests).allSatisfy(r -> assertThat(r.traceId()).isEqualTo("trace-agent"));
        String first = requests.getFirst().bodyText();
        assertThat(JsonPath.<String>read(first, "$.companyName")).isEqualTo("예시전자");
        assertThat(JsonPath.<List<String>>read(first, "$.tools[*].name")).containsExactly("search_text_changes",
                "get_text_change", "get_financial_changes", "get_document_outline", "get_document_section",
                "answer_with_evidence", "get_summary", "explain_text_change", "find_related_disclosures",
                "search_companies", "get_company_overview", "get_financial_trends", "get_key_facts", "get_checkpoints",
                "get_disclosures", "get_disclosure_signals", "get_disclosure_key_items", "get_company_briefing",
                "get_outlook", "get_plan_followups", "find_analyses", "get_report_pairs", "check_comparability");
        assertThat(JsonPath.<List<String>>read(first, "$.actions[*].type")).containsExactly("OPEN_TAB",
                "OPEN_TEXT_CHANGE", "OPEN_FINANCIAL_CHANGE", "OPEN_DOCUMENT", "OPEN_GLOSSARY", "DOWNLOAD_BRIEF",
                "CONFIRM_SAVE_NOTE", "CONFIRM_FAVORITE", "PIN_CHANGE", "OPEN_POST_DRAFT", "OPEN_ANALYSIS",
                "OPEN_COMPANY_COMPARE", "CONFIRM_REQUEST_ANALYSIS");
        assertThat(JsonPath.<Integer>read(first, "$.remainingSteps")).isEqualTo(4);
        String second = requests.get(1).bodyText();
        assertThat(JsonPath.<Integer>read(second, "$.remainingSteps")).isEqualTo(3);
        assertThat(JsonPath.<Boolean>read(second, "$.toolResults[0].ok")).isTrue();
        assertThat(JsonPath.<List<String>>read(second, "$.toolResults[0].items[*].evidenceId")).contains(evidence);
        assertThat(jdbcTemplate.queryForList("SELECT task FROM llm_call WHERE analysis_id = ? ORDER BY id",
                String.class, analysisId)).containsExactly("agent_plan", "agent_answer");
    }

    @Test
    @DisplayName("재무 변화 Tool은 저장된 계산 결과의 사실 문장을 근거 F{changeId}로 보낸다")
    void financialChangesAreSentAsStoredFacts() throws Exception {
        long changeId = changeRepository.findByAnalysisIdOrderBySjDivAscDisplayOrderAsc(analysisId).getFirst()
                .getId();
        AI.on(STEPS, twoSteps("{\"callId\":\"c1\",\"name\":\"get_financial_changes\",\"arguments\":{\"q\":\"영업 이익\"}}",
                request -> finalAnswer("ANSWERED", "영업이익이 줄었어요[F" + changeId + "].", "\"F" + changeId + "\"",
                        "")));

        chat("영업이익 어디 있어?")
                .andExpect(jsonPath("$.citations[0].kind").value("FINANCIAL_CHANGE"))
                .andExpect(jsonPath("$.citations[0].accountName").value("영업이익"))
                .andExpect(jsonPath("$.citations[0].sjDiv").value("IS"));

        String second = AI.requests(STEPS).get(1).bodyText();
        String text = JsonPath.read(second, "$.toolResults[0].items[0].text");
        assertThat(text).startsWith("[IS, changeId " + changeId + "] ").contains("영업이익");
        // 교차 검증 판정용 구조화 값(글을 다시 읽지 않게)
        assertThat(JsonPath.<Integer>read(second, "$.toolResults[0].items[0].facts.changeId").longValue())
                .isEqualTo(changeId);
        assertThat(JsonPath.<String>read(second, "$.toolResults[0].items[0].facts.direction")).isIn("UP", "DOWN");
        assertThat(JsonPath.<String>read(second, "$.toolResults[0].items[0].facts.calcStatus")).isNotBlank();
    }

    @Test
    @DisplayName("원문 목차·항목 Tool은 항목 번호(#S)와 문단(#B) 근거를 보낸다")
    void documentToolsSendSectionsAndBlocks() throws Exception {
        AI.on(STEPS, request -> {
            List<?> results = JsonPath.read(request.bodyText(), "$.toolResults");
            return Reply.ok(switch (results.size()) {
                case 0 -> toolCalls("{\"callId\":\"c1\",\"name\":\"get_document_outline\",\"arguments\":"
                        + "{\"side\":\"current\"}}");
                case 1 -> toolCalls("{\"callId\":\"c2\",\"name\":\"get_document_section\",\"arguments\":"
                        + "{\"side\":\"current\",\"sectionNo\":1}}");
                default -> finalAnswer("ANSWERED", "사업의 내용을 열었어요[" + CUR + "#S1].", "\"" + CUR + "#S1\"",
                        "{\"type\":\"OPEN_DOCUMENT\",\"side\":\"current\",\"sectionNo\":1,\"blockNo\":null}");
            });
        });

        chat("사업의 내용 열어줘")
                .andExpect(jsonPath("$.citations[0].kind").value("SECTION"))
                .andExpect(jsonPath("$.citations[0].sectionNo").value(1))
                .andExpect(jsonPath("$.actions[0].type").value("OPEN_DOCUMENT"))
                .andExpect(jsonPath("$.actions[0].blockNo").doesNotExist());

        String last = AI.requests(STEPS).get(2).bodyText();
        assertThat(JsonPath.<List<String>>read(last, "$.toolResults[0].items[*].evidenceId"))
                .containsExactly(CUR + "#S1", CUR + "#S3");
        assertThat(JsonPath.<String>read(last, "$.toolResults[0].items[0].text"))
                .isEqualTo("[항목 1] II. 사업의 내용 — 하위: [항목 2] 1. 사업의 개요");
        assertThat(JsonPath.<List<String>>read(last, "$.toolResults[1].items[*].evidenceId"))
                .containsExactly(CUR + "#B1");
    }

    @Test
    @DisplayName("근거 ID가 이 채팅의 Tool 결과에 없으면 답을 버리고 검토 필요로 끝낸다")
    void answerCitingUnknownEvidenceIsReviewNeeded() throws Exception {
        AI.on(STEPS, Reply.ok(finalAnswer("ANSWERED", "소송이 있어요[T999].", "\"T999\"", "")));

        chat("소송 있어?")
                .andExpect(jsonPath("$.status").value("REVIEW_NEEDED"))
                .andExpect(jsonPath("$.answer").doesNotExist())
                .andExpect(jsonPath("$.citations", hasSize(0)))
                .andExpect(jsonPath("$.aiGenerated").value(false));
        assertThat(llmCalls()).isEqualTo(1);
    }

    @Test
    @DisplayName("투자 판단 요청은 OUT_OF_SCOPE 안내로 끝난다")
    void outOfScopeEndsWithMessage() throws Exception {
        AI.on(STEPS, Reply.ok("""
                {"promptVersion":"agent-1","model":null,"generatedAt":null,"type":"OUT_OF_SCOPE","toolCalls":[],
                 "final":null,"rejections":[],"calls":[]}
                """));

        chat("이 회사 지금 사도 돼?")
                .andExpect(jsonPath("$.status").value("OUT_OF_SCOPE"))
                .andExpect(jsonPath("$.message").isNotEmpty())
                .andExpect(jsonPath("$.aiGenerated").value(false));
        assertThat(llmCalls()).isZero();
    }

    @Test
    @DisplayName("게시판 글 초안은 backend가 기업·인용 분석과 본문(검토를 통과한 답에서 근거 표시를 뺀 글)을 채우고, 이 분석에 없는 변경이면 인용만 뺀다(AC26)")
    void postDraftIsFilledByBackend() throws Exception {
        AI.on(STEPS, twoSteps("{\"callId\":\"c1\",\"name\":\"search_text_changes\",\"arguments\":{\"q\":\"소송\"}}",
                request -> finalAnswer("ANSWERED", "특허 침해 소송 문장이 새로 들어갔어요[T" + lawsuitChangeId + "].",
                        "\"T" + lawsuitChangeId + "\"",
                        "{\"type\":\"OPEN_POST_DRAFT\",\"quote\":{\"kind\":\"TEXT_CHANGE\",\"changeId\":"
                                + lawsuitChangeId + "}},"
                                + "{\"type\":\"OPEN_POST_DRAFT\",\"quote\":{\"kind\":\"TEXT_CHANGE\",\"changeId\":999999}},"
                                + "{\"type\":\"PIN_CHANGE\",\"changeId\":" + lawsuitChangeId + "},"
                                + "{\"type\":\"PIN_CHANGE\",\"changeId\":999999}")));

        chat("이 소송 변경으로 게시판 글 써줘")
                .andExpect(jsonPath("$.status").value("ANSWERED"))
                .andExpect(jsonPath("$.actions", hasSize(3)))
                .andExpect(jsonPath("$.actions[0].type").value("OPEN_POST_DRAFT"))
                .andExpect(jsonPath("$.actions[0].corpCode").value("00000001"))
                .andExpect(jsonPath("$.actions[0].quote.kind").value("TEXT_CHANGE"))
                .andExpect(jsonPath("$.actions[0].quote.analysisId").value(analysisId))
                .andExpect(jsonPath("$.actions[0].quote.changeId").value(lawsuitChangeId))
                .andExpect(jsonPath("$.actions[0].body").value("특허 침해 소송 문장이 새로 들어갔어요."))
                .andExpect(jsonPath("$.actions[1].type").value("OPEN_POST_DRAFT"))
                .andExpect(jsonPath("$.actions[1].quote").doesNotExist())
                .andExpect(jsonPath("$.actions[1].body").value("특허 침해 소송 문장이 새로 들어갔어요."))
                .andExpect(jsonPath("$.actions[2].type").value("PIN_CHANGE"))
                .andExpect(jsonPath("$.actions[2].changeId").value(lawsuitChangeId));
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM community_post", Integer.class)).isZero();
    }

    @Test
    @DisplayName("답하지 못한(NOT_FOUND) 채팅에는 본문을 채울 답이 없어 게시판 글 초안 액션을 내보내지 않는다")
    void postDraftIsDroppedWithoutAnswer() throws Exception {
        AI.on(STEPS, Reply.ok(finalAnswer("NOT_FOUND", null, "", "{\"type\":\"OPEN_POST_DRAFT\"}")));

        chat("게시판 글 써줘")
                .andExpect(jsonPath("$.status").value("NOT_FOUND"))
                .andExpect(jsonPath("$.actions", hasSize(0)));
    }

    @Test
    @DisplayName("대화 기록 한 턴은 답 상한과 같은 1,500자까지 받고 넘으면 400이다")
    void historyTurnAllowsUpToAnswerLimit() throws Exception {
        AI.on(STEPS, Reply.ok(finalAnswer("NOT_FOUND", null, "", "")));
        String ok = "가".repeat(1500);
        chat(analysisId, "{\"message\":\"이어서 알려줘\",\"history\":[{\"role\":\"assistant\",\"text\":\""
                + ok + "\"}]}").andExpect(status().isOk());
        chat(analysisId, "{\"message\":\"이어서 알려줘\",\"history\":[{\"role\":\"assistant\",\"text\":\""
                + ok + "가\"}]}").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("history[0].text"));
    }

    @Test
    @DisplayName("답 길이는 코드 포인트로 세어 보조 문자(이모지)를 1자로 본다")
    void answerLengthCountsCodePoints() throws Exception {
        String block = CUR + "#B5";
        String answer = "특허 침해 소송이 있어요" + "😀".repeat(900) + "[" + block + "].";
        AI.on(STEPS, twoSteps("{\"callId\":\"c1\",\"name\":\"get_summary\",\"arguments\":{}}",
                request -> finalAnswer("ANSWERED", answer, "\"" + block + "\"", "")));

        chat("소송 알려줘").andExpect(jsonPath("$.status").value("ANSWERED"));
    }

    @Test
    @DisplayName("ai-server가 LLM 없이 정해진 안내로 답하면(model·calls 없음) 근거 없이 그대로 내보내고 AI 생성 표시를 붙이지 않는다(#631)")
    void fixedAnswerWithoutLlmIsSentAsIs() throws Exception {
        long changeId = financialChangeId();
        AI.on(STEPS, Reply.ok("""
                {"promptVersion":"agent-3","model":null,"generatedAt":null,"type":"FINAL","toolCalls":[],
                 "final":{"status":"ANSWERED","answer":"아래 버튼을 누르면 노트에 담아요.","evidenceIds":[],
                  "actions":[{"type":"CONFIRM_SAVE_NOTE","note":{"kind":"FINANCIAL_CHANGE","changeId":%d}}],
                  "reviewReason":null,"blockedRules":[],"format":"CHAT","crossCheck":null},
                 "rejections":[],"calls":[]}
                """.formatted(changeId)));

        chat(analysisId, "{\"message\":\"이거 노트에 담아줘\",\"context\":{\"tab\":\"financial\","
                + "\"financialChangeId\":" + changeId + "}}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ANSWERED"))
                .andExpect(jsonPath("$.answer").value("아래 버튼을 누르면 노트에 담아요."))
                .andExpect(jsonPath("$.citations", hasSize(0)))
                .andExpect(jsonPath("$.actions[0].type").value("CONFIRM_SAVE_NOTE"))
                .andExpect(jsonPath("$.actions[0].note.changeId").value(changeId))
                .andExpect(jsonPath("$.actions[0].note.analysisId").value(analysisId))
                .andExpect(jsonPath("$.aiGenerated").value(false))
                .andExpect(jsonPath("$.ai").doesNotExist());

        String sent = AI.requests(STEPS).getFirst().bodyText();
        assertThat(JsonPath.<Integer>read(sent, "$.context.financialChangeId").longValue()).isEqualTo(changeId);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM llm_call WHERE analysis_id = ?", Integer.class,
                analysisId)).isZero();
    }

    @Test
    @DisplayName("정해진 안내에 목차 제목의 대괄호('[첨부]')가 있어도 근거 표시로 보지 않고 그대로 내보낸다")
    void fixedAnswerWithBracketTitleIsSentAsIs() throws Exception {
        AI.on(STEPS, Reply.ok("""
                {"promptVersion":"agent-3","model":null,"generatedAt":null,"type":"FINAL","toolCalls":[],
                 "final":{"status":"ANSWERED","answer":"아래 버튼을 누르면 원문의 '[첨부] 감사보고서' 항목을 열어요.",
                  "evidenceIds":[],"actions":[{"type":"OPEN_DOCUMENT","side":"current","sectionNo":1}],
                  "reviewReason":null,"blockedRules":[],"format":"CHAT","crossCheck":null},
                 "rejections":[],"calls":[]}
                """));

        chat("[첨부] 감사보고서 열어줘")
                .andExpect(jsonPath("$.status").value("ANSWERED"))
                .andExpect(jsonPath("$.answer").value("아래 버튼을 누르면 원문의 '[첨부] 감사보고서' 항목을 열어요."))
                .andExpect(jsonPath("$.actions[0].type").value("OPEN_DOCUMENT"))
                .andExpect(jsonPath("$.aiGenerated").value(false));
    }

    @Test
    @DisplayName("model 없는 답이라도 근거 ID 모양의 표시가 있으면 정해진 안내로 보지 않는다")
    void answerWithEvidenceMarkerIsNotFixedAnswer() throws Exception {
        AI.on(STEPS, Reply.ok("""
                {"promptVersion":"agent-3","model":null,"generatedAt":null,"type":"FINAL","toolCalls":[],
                 "final":{"status":"ANSWERED","answer":"영업이익이 줄었어요[F1].","evidenceIds":[],"actions":[],
                  "reviewReason":null,"blockedRules":[],"format":"CHAT","crossCheck":null},
                 "rejections":[],"calls":[]}
                """));

        chat("영업이익 알려줘").andExpect(jsonPath("$.status").value("REVIEW_NEEDED"));
    }

    @Test
    @DisplayName("정해진 안내의 버튼이 값 확인에서 빠지면(이 분석에 없는 변경) 저장 안내를 내보내지 않고 NOT_FOUND로 끝낸다")
    void fixedAnswerWithoutValidActionIsNotFound() throws Exception {
        AI.on(STEPS, Reply.ok("""
                {"promptVersion":"agent-3","model":null,"generatedAt":null,"type":"FINAL","toolCalls":[],
                 "final":{"status":"ANSWERED","answer":"아래 버튼을 누르면 노트에 담아요.","evidenceIds":[],
                  "actions":[{"type":"CONFIRM_SAVE_NOTE","note":{"kind":"FINANCIAL_CHANGE","changeId":999999}}],
                  "reviewReason":null,"blockedRules":[],"format":"CHAT","crossCheck":null},
                 "rejections":[],"calls":[]}
                """));

        chat(analysisId, "{\"message\":\"이거 노트에 담아줘\",\"context\":{\"tab\":\"financial\","
                + "\"financialChangeId\":999999}}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NOT_FOUND"))
                .andExpect(jsonPath("$.answer").doesNotExist())
                .andExpect(jsonPath("$.message").value("실행한 기능의 결과에서 관련 자료를 찾지 못했어요."))
                .andExpect(jsonPath("$.actions", hasSize(0)))
                .andExpect(jsonPath("$.aiGenerated").value(false));
    }

    @Test
    @DisplayName("LLM이 만든 답(model 있음)에 근거 표시가 없으면 정해진 안내로 보지 않고 검토 필요로 끝낸다")
    void llmAnswerWithoutMarkerIsStillReviewNeeded() throws Exception {
        AI.on(STEPS, Reply.ok(finalAnswer("ANSWERED", "근거 없이 쓴 답이에요.", "", "")));

        chat("영업이익 알려줘")
                .andExpect(jsonPath("$.status").value("REVIEW_NEEDED"))
                .andExpect(jsonPath("$.answer").doesNotExist());
    }

    @Test
    @DisplayName("NOT_FOUND는 찾지 못했다는 안내이고, 화면 제목('확인된 설명 없음')을 본문에 다시 넣지 않는다")
    void notFoundShowsNoConfirmedExplanation() throws Exception {
        AI.on(STEPS, Reply.ok(finalAnswer("NOT_FOUND", null, "", "")));

        chat("합병 관련 변경 있어?")
                .andExpect(jsonPath("$.status").value("NOT_FOUND"))
                .andExpect(jsonPath("$.answer").doesNotExist())
                .andExpect(jsonPath("$.message").value("실행한 기능의 결과에서 관련 자료를 찾지 못했어요."));
    }

    @Test
    @DisplayName("조회 Tool 없이 저장 확인 버튼만 있는 NOT_FOUND는 정해진 안내의 ANSWERED로 바꾸고 버튼을 그대로 보낸다(#623)")
    void confirmOnlyNotFoundBecomesAnswered() throws Exception {
        AI.on(STEPS, Reply.ok(finalAnswer("NOT_FOUND", null, "", "{\"type\":\"CONFIRM_FAVORITE\"}")));

        chat("이 기업 관심 기업에 추가해줘")
                .andExpect(jsonPath("$.status").value("ANSWERED"))
                .andExpect(jsonPath("$.answer").value("아래 버튼을 누르면 저장해요."))
                .andExpect(jsonPath("$.message").doesNotExist())
                .andExpect(jsonPath("$.citations", hasSize(0)))
                .andExpect(jsonPath("$.actions[0].type").value("CONFIRM_FAVORITE"))
                .andExpect(jsonPath("$.actions[0].corpCode").value("00000001"))
                .andExpect(jsonPath("$.aiGenerated").value(false))
                .andExpect(jsonPath("$.ai").doesNotExist())
                .andExpect(jsonPath("$.questionId").doesNotExist());
    }

    @Test
    @DisplayName("변경을 찾는 Tool 결과에 노트 대상이 있어도 조회 의도를 가릴 수 없으면 NOT_FOUND를 감추지 않는다")
    void changeLookupWithNoteTargetStaysNotFound() throws Exception {
        long changeId = financialChangeId();
        AI.on(STEPS, twoSteps("{\"callId\":\"c1\",\"name\":\"get_financial_changes\",\"arguments\":{}}",
                request -> finalAnswer("NOT_FOUND", null, "", "{\"type\":\"CONFIRM_SAVE_NOTE\",\"note\":"
                        + "{\"kind\":\"FINANCIAL_CHANGE\",\"changeId\":" + changeId + "}}")));

        chat("영업이익 변화 알려주고 노트에도 담아줘")
                .andExpect(jsonPath("$.status").value("NOT_FOUND"))
                .andExpect(jsonPath("$.answer").doesNotExist())
                .andExpect(jsonPath("$.actions[0].type").value("CONFIRM_SAVE_NOTE"))
                .andExpect(jsonPath("$.actions[0].note.changeId").value(changeId));
    }

    @Test
    @DisplayName("화면에서 고른 변경을 Tool 없이 노트에 담는 순수 저장 요청은 정해진 안내의 ANSWERED로 바꾼다")
    void selectedChangeSaveWithoutToolBecomesAnswered() throws Exception {
        long changeId = financialChangeId();
        AI.on(STEPS, Reply.ok(finalAnswer("NOT_FOUND", null, "", "{\"type\":\"CONFIRM_SAVE_NOTE\",\"note\":"
                + "{\"kind\":\"FINANCIAL_CHANGE\",\"changeId\":" + changeId + "}}")));

        chat(analysisId, "{\"message\":\"이거 노트에 담아줘\",\"context\":{\"tab\":\"financial\","
                + "\"financialChangeId\":" + changeId + "}}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ANSWERED"))
                .andExpect(jsonPath("$.answer").value("아래 버튼을 누르면 저장해요."))
                .andExpect(jsonPath("$.actions[0].type").value("CONFIRM_SAVE_NOTE"))
                .andExpect(jsonPath("$.aiGenerated").value(false));
    }

    @Test
    @DisplayName("요약처럼 정보를 보는 Tool은 결과에 노트 대상이 들어 있어도 조회로 보아 NOT_FOUND를 감추지 않는다")
    void summaryLookupWithNoteTargetStaysNotFound() throws Exception {
        long changeId = financialChangeId();
        AI.on(STEPS, twoSteps("{\"callId\":\"c1\",\"name\":\"get_summary\",\"arguments\":{}}",
                request -> {
                    assertThat(request.bodyText()).contains("\"F" + changeId + "\"");
                    return finalAnswer("NOT_FOUND", null, "", "{\"type\":\"CONFIRM_SAVE_NOTE\",\"note\":"
                            + "{\"kind\":\"FINANCIAL_CHANGE\",\"changeId\":" + changeId + "}}");
                }));

        chat("영업이익 감소 이유를 설명하고 해당 변경을 노트에 담아줘")
                .andExpect(jsonPath("$.status").value("NOT_FOUND"))
                .andExpect(jsonPath("$.answer").doesNotExist())
                .andExpect(jsonPath("$.actions[0].type").value("CONFIRM_SAVE_NOTE"));
    }

    @Test
    @DisplayName("저장 대상 Tool과 함께 따로 조회한 Tool이 못 찾았으면 노트 확인 버튼이 있어도 NOT_FOUND를 감추지 않는다")
    void lookupBesideNoteTargetStaysNotFound() throws Exception {
        long changeId = financialChangeId();
        AI.on(STEPS, twoSteps("{\"callId\":\"c1\",\"name\":\"search_text_changes\",\"arguments\":{\"q\":\"합병\"}},"
                        + "{\"callId\":\"c2\",\"name\":\"get_financial_changes\",\"arguments\":{}}",
                request -> finalAnswer("NOT_FOUND", null, "", "{\"type\":\"CONFIRM_SAVE_NOTE\",\"note\":"
                        + "{\"kind\":\"FINANCIAL_CHANGE\",\"changeId\":" + changeId + "}}")));

        chat("합병 관련 변경을 알려주고 영업이익 변경은 노트에 담아줘")
                .andExpect(jsonPath("$.status").value("NOT_FOUND"))
                .andExpect(jsonPath("$.answer").doesNotExist())
                .andExpect(jsonPath("$.actions[0].type").value("CONFIRM_SAVE_NOTE"));
    }

    @Test
    @DisplayName("조회 Tool을 실행했는데 못 찾은 조회·저장 복합 요청은 확인 버튼이 있어도 NOT_FOUND를 감추지 않는다")
    void lookupAndConfirmNotFoundStaysNotFound() throws Exception {
        AI.on(STEPS, twoSteps("{\"callId\":\"c1\",\"name\":\"search_text_changes\",\"arguments\":{\"q\":\"합병\"}}",
                request -> finalAnswer("NOT_FOUND", null, "", "{\"type\":\"CONFIRM_FAVORITE\"}")));

        chat("합병 관련 변경 내용을 알려주고 관심 기업에도 추가해줘")
                .andExpect(jsonPath("$.status").value("NOT_FOUND"))
                .andExpect(jsonPath("$.answer").doesNotExist())
                .andExpect(jsonPath("$.message").value("실행한 기능의 결과에서 관련 자료를 찾지 못했어요."))
                .andExpect(jsonPath("$.actions[0].type").value("CONFIRM_FAVORITE"))
                .andExpect(jsonPath("$.actions[0].corpCode").value("00000001"));
    }

    @Test
    @DisplayName("이동 버튼만 있는 NOT_FOUND는 찾지 못했다는 것을 가리지 않게 그대로 둔다")
    void navigationOnlyNotFoundStaysNotFound() throws Exception {
        AI.on(STEPS, Reply.ok(finalAnswer("NOT_FOUND", null, "", "{\"type\":\"OPEN_TAB\",\"tab\":\"text\"}")));

        chat("합병 관련 변경 있어?")
                .andExpect(jsonPath("$.status").value("NOT_FOUND"))
                .andExpect(jsonPath("$.answer").doesNotExist())
                .andExpect(jsonPath("$.actions[0].type").value("OPEN_TAB"));
    }

    @Test
    @DisplayName("왕복 상한(5회)을 넘으면 부분 결과 없이 INCOMPLETE이고 남은 왕복 수를 줄여 보낸다")
    void stopsAtStepLimit() throws Exception {
        AI.on(STEPS, request -> Reply.ok(toolCalls("{\"callId\":\"c" + AI.requests(STEPS).size()
                + "\",\"name\":\"search_text_changes\",\"arguments\":{\"q\":\"소송" + AI.requests(STEPS).size()
                + "\"}}")));

        chat("소송 관련 변경 계속 찾아줘")
                .andExpect(jsonPath("$.status").value("INCOMPLETE"))
                .andExpect(jsonPath("$.answer").doesNotExist())
                .andExpect(jsonPath("$.citations", hasSize(0)));
        assertThat(AI.requests(STEPS).stream().map(r -> JsonPath.<Integer>read(r.bodyText(), "$.remainingSteps")))
                .containsExactly(4, 3, 2, 1, 0);
        assertThat(llmCalls()).isEqualTo(5);
    }

    @Test
    @DisplayName("목록에 없는 Tool·형식이 틀린 인자·없는 ID는 실행하지 않고 실패한 결과로 돌려준다")
    void invalidToolCallsComeBackAsFailedResults() throws Exception {
        AI.on(STEPS, twoSteps("{\"callId\":\"c1\",\"name\":\"delete_note\",\"arguments\":{}},"
                        + "{\"callId\":\"c2\",\"name\":\"get_text_change\",\"arguments\":{\"changeId\":\"x\"}},"
                        + "{\"callId\":\"c3\",\"name\":\"get_text_change\",\"arguments\":{\"changeId\":999999}}",
                request -> finalAnswer("NOT_FOUND", null, "", "")));

        chat("이 변경 보여줘").andExpect(status().isOk());

        String second = AI.requests(STEPS).get(1).bodyText();
        assertThat(JsonPath.<List<Boolean>>read(second, "$.toolResults[*].ok")).containsExactly(false, false, false);
        assertThat(JsonPath.<List<String>>read(second, "$.toolResults[*].error")).allSatisfy(e -> assertThat(e)
                .isNotBlank());
    }

    @Test
    @DisplayName("화면에서 고른 변경은 첫 왕복 전에 Tool 결과로 넣고, 이 분석에 없는 ID는 뺀다")
    void selectedChangeIsSentBeforeFirstStep() throws Exception {
        AI.on(STEPS, Reply.ok(finalAnswer("NOT_FOUND", null, "", "")));

        chat(analysisId, "{\"message\":\"이 변경 좋은 거야?\",\"context\":{\"tab\":\"text\",\"textChangeId\":"
                + lawsuitChangeId + ",\"financialChangeId\":999999}}").andExpect(status().isOk());

        String first = AI.requests(STEPS).getFirst().bodyText();
        assertThat(JsonPath.<List<String>>read(first, "$.toolResults[*].callId")).containsExactly("ctx-text");
        assertThat(JsonPath.<List<String>>read(first, "$.toolResults[0].items[*].evidenceId"))
                .containsExactly("T" + lawsuitChangeId, CUR + "#B5");
        assertThat(JsonPath.<String>read(first, "$.context.tab")).isEqualTo("text");
    }

    @Test
    @DisplayName("AI 서버나 LLM을 쓸 수 없으면 503이고, 그때까지의 호출 기록은 저장한다")
    void unavailableAiServerIs503AndKeepsCallRecords() throws Exception {
        String header = Base64.getUrlEncoder().encodeToString(("[" + CALL.formatted("agent_answer") + "]")
                .getBytes(StandardCharsets.UTF_8));
        AI.on(STEPS, request -> {
            List<?> results = JsonPath.read(request.bodyText(), "$.toolResults");
            return results.isEmpty()
                    ? Reply.ok(toolCalls("{\"callId\":\"c1\",\"name\":\"search_text_changes\",\"arguments\":{}}"))
                    : Reply.error(503, "AI_LLM_UNAVAILABLE", "LLM을 쓸 수 없어요.").withHeader("X-Llm-Calls", header);
        });

        chat("소송 관련 변경")
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("AI_SERVER_UNAVAILABLE"));
        assertThat(jdbcTemplate.queryForList("SELECT task FROM llm_call WHERE analysis_id = ? ORDER BY id",
                String.class, analysisId)).containsExactly("agent_plan", "agent_answer");
    }

    @Test
    @DisplayName("원문 Tool에 필수 side가 없으면 500이 아니라 실패한 Tool 결과다")
    void missingSideIsFailedToolResult() throws Exception {
        AI.on(STEPS, twoSteps("{\"callId\":\"c1\",\"name\":\"get_document_outline\",\"arguments\":{}},"
                        + "{\"callId\":\"c2\",\"name\":\"get_document_section\",\"arguments\":{\"sectionNo\":1}}",
                request -> finalAnswer("NOT_FOUND", null, "", "")));

        chat("목차 보여줘").andExpect(status().isOk());

        String second = AI.requests(STEPS).get(1).bodyText();
        assertThat(JsonPath.<List<Boolean>>read(second, "$.toolResults[*].ok")).containsExactly(false, false);
    }

    @Test
    @DisplayName("원문 열기 액션의 문단 번호는 그 항목에 있을 때만 남긴다")
    void documentActionKeepsOnlyExistingBlock() throws Exception {
        String evidence = "T" + lawsuitChangeId;
        AI.on(STEPS, twoSteps("{\"callId\":\"c1\",\"name\":\"search_text_changes\",\"arguments\":{}}",
                request -> finalAnswer("ANSWERED", "소송이 있어요[" + evidence + "].", "\"" + evidence + "\"",
                        "{\"type\":\"OPEN_DOCUMENT\",\"side\":\"current\",\"sectionNo\":3,\"blockNo\":5},"
                                + "{\"type\":\"OPEN_DOCUMENT\",\"side\":\"current\",\"sectionNo\":3,\"blockNo\":1}")));

        chat("소송 원문 열어줘")
                .andExpect(jsonPath("$.actions", hasSize(1)))
                .andExpect(jsonPath("$.actions[0].blockNo").value(5));
    }

    @Test
    @DisplayName("문장 변경 검색 결과는 변경 줄만이라 size만큼 변경을 보낸다")
    void searchResultHasOnlyChangeLines() throws Exception {
        AI.on(STEPS, twoSteps("{\"callId\":\"c1\",\"name\":\"search_text_changes\",\"arguments\":{\"size\":1}}",
                request -> finalAnswer("NOT_FOUND", null, "", "")));

        chat("변경 하나만").andExpect(status().isOk());

        String second = AI.requests(STEPS).get(1).bodyText();
        assertThat(JsonPath.<List<String>>read(second, "$.toolResults[0].items[*].evidenceId"))
                .containsExactly("T" + lawsuitChangeId);
    }

    private static final String ANSWERS = "/internal/answers";

    private long financialChangeId() {
        return changeRepository.findByAnalysisIdOrderBySjDivAscDisplayOrderAsc(analysisId).getFirst().getId();
    }

    @Test
    @DisplayName("근거 질문 Tool은 기존 질문 서비스로 답해 analysis_question에 저장하고, 그 질문 ID와 답 인용 노트 담기 확인 액션을 돌려준다")
    void answerToolSavesQuestionAndReturnsQuestionId() throws Exception {
        String block = CUR + "#B5";
        AI.on(ANSWERS, Reply.ok("""
                {"promptVersion":"answer-2","expressionRulesVersion":"expr-1","model":"fake-model",
                 "generatedAt":"2026-11-03T10:12:03","status":"ANSWERED","answer":"특허 침해 소송을 제기받았어요[%s].",
                 "evidenceIds":["%s"],"factRefs":[],"reviewReason":null,"blockedRules":[],
                 "calls":[%s]}
                """.formatted(block, block, CALL.formatted("answer"))));
        AI.on(STEPS, twoSteps("{\"callId\":\"c1\",\"name\":\"answer_with_evidence\",\"arguments\":"
                        + "{\"question\":\"소송이 왜 생겼나요?\"}}",
                request -> {
                    String first = JsonPath.read(request.bodyText(), "$.toolResults[0].items[0].text");
                    Matcher id = Pattern.compile("질문 ID (\\d+)").matcher(first);
                    assertThat(id.find()).isTrue();
                    return finalAnswer("ANSWERED", "특허 침해 소송을 제기받았어요[" + block + "].", "\"" + block + "\"",
                            "{\"type\":\"CONFIRM_SAVE_NOTE\",\"note\":{\"kind\":\"ANSWER_CITATION\",\"questionId\":"
                                    + id.group(1) + ",\"citationNo\":1,\"memo\":\"소송 확인\"}},"
                                    + "{\"type\":\"CONFIRM_SAVE_NOTE\",\"note\":{\"kind\":\"ANSWER_CITATION\","
                                    + "\"questionId\":" + id.group(1) + ",\"citationNo\":2}}");
                }));

        String body = chat("소송이 왜 생겼어?")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ANSWERED"))
                .andExpect(jsonPath("$.citations[0].kind").value("BLOCK"))
                .andExpect(jsonPath("$.citations[0].evidenceId").value(block))
                .andExpect(jsonPath("$.actions", hasSize(1)))
                .andExpect(jsonPath("$.actions[0].label").value("노트에 담기"))
                .andExpect(jsonPath("$.actions[0].note.analysisId").value(analysisId))
                .andExpect(jsonPath("$.actions[0].note.citationNo").value(1))
                .andExpect(jsonPath("$.actions[0].note.memo").value("소송 확인"))
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);

        Long saved = jdbcTemplate.queryForObject("SELECT id FROM analysis_question WHERE analysis_id = ?", Long.class,
                analysisId);
        assertThat(JsonPath.<Integer>read(body, "$.questionId").longValue()).isEqualTo(saved);
        assertThat(JsonPath.<Integer>read(body, "$.actions[0].note.questionId").longValue()).isEqualTo(saved);
        assertThat(jdbcTemplate.queryForList("SELECT task FROM llm_call WHERE analysis_id = ? ORDER BY id",
                String.class, analysisId)).contains("answer", "agent_plan", "agent_answer");
    }

    @Test
    @DisplayName("채팅이 넘긴 '소송 관련 변경 사항을 설명해줘'도 근거 질문이 소송 문단을 후보로 보내 답하고 questionId를 돌려준다(#622)")
    void answerToolFindsLawsuitParagraphForChangeQuestion() throws Exception {
        String block = CUR + "#B5";
        AI.on(ANSWERS, Reply.ok("""
                {"promptVersion":"answer-2","expressionRulesVersion":"expr-1","model":"fake-model",
                 "generatedAt":"2026-11-03T10:12:03","status":"ANSWERED","answer":"특허 침해 소송을 제기받았어요[%s].",
                 "evidenceIds":["%s"],"factRefs":[],"reviewReason":null,"blockedRules":[],
                 "calls":[%s]}
                """.formatted(block, block, CALL.formatted("answer"))));
        AI.on(STEPS, twoSteps("{\"callId\":\"c1\",\"name\":\"answer_with_evidence\",\"arguments\":"
                        + "{\"question\":\"소송 관련 변경 사항을 설명해줘\"}}",
                request -> finalAnswer("ANSWERED", "특허 침해 소송을 제기받았어요[" + block + "].", "\"" + block + "\"", "")));

        chat("소송 관련 변경을 원문 근거와 함께 설명해줘")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ANSWERED"))
                .andExpect(jsonPath("$.questionId").isNumber());

        String sent = AI.requests(ANSWERS).getFirst().bodyText();
        assertThat(JsonPath.<List<String>>read(sent, "$.sources[*].evidenceId")).contains(block);
    }

    @Test
    @DisplayName("근거 질문이 답하지 못했으면 채팅 답이 다른 Tool로 ANSWERED여도 questionId를 내보내지 않는다(평가할 답이 없음)")
    void notAnsweredQuestionIsNotReturned() throws Exception {
        AI.on(ANSWERS, Reply.ok("""
                {"promptVersion":"answer-2","expressionRulesVersion":"expr-1","model":null,"generatedAt":null,
                 "status":"NOT_FOUND","answer":null,"evidenceIds":[],"factRefs":[],"reviewReason":null,
                 "blockedRules":[],"calls":[]}
                """));
        AI.on(STEPS, twoSteps("{\"callId\":\"c1\",\"name\":\"answer_with_evidence\",\"arguments\":"
                        + "{\"question\":\"소송이 왜 생겼나요?\"}},"
                        + "{\"callId\":\"c2\",\"name\":\"get_summary\",\"arguments\":{}}",
                request -> finalAnswer("ANSWERED", "관련 공시 내용으로 소송이 있어요[" + CUR + "#B5].",
                        "\"" + CUR + "#B5\"", "")));

        chat("소송이 왜 생겼어?")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ANSWERED"))
                .andExpect(jsonPath("$.questionId").doesNotExist());

        assertThat(jdbcTemplate.queryForObject("SELECT status FROM analysis_question WHERE analysis_id = ?",
                String.class, analysisId)).isEqualTo("NOT_FOUND");
    }

    @Test
    @DisplayName("요약 Tool은 저장된 요약만 보내고 재무 설명 등급·인용을 그대로 넘긴다")
    void summaryToolSendsStoredGrades() throws Exception {
        long changeId = financialChangeId();
        AI.on(STEPS, twoSteps("{\"callId\":\"c1\",\"name\":\"get_summary\",\"arguments\":{}}",
                request -> finalAnswer("ANSWERED", "관련 공시 내용으로 소송이 있어요[" + CUR + "#B5].",
                        "\"" + CUR + "#B5\"", "")));

        chat("이 변경 좋은 거야?")
                .andExpect(jsonPath("$.citations[0].kind").value("BLOCK"))
                .andExpect(jsonPath("$.citations[0].grade").value("RELATED"))
                .andExpect(jsonPath("$.citations[0].side").value("current"))
                .andExpect(jsonPath("$.citations[0].sectionNo").value(3))
                .andExpect(jsonPath("$.citations[0].blockNo").value(5))
                .andExpect(jsonPath("$.citations[0].sectionPath").value("XI. 그 밖에 투자자 보호를 위하여 필요한 사항"));

        String second = AI.requests(STEPS).get(1).bodyText();
        assertThat(JsonPath.<List<String>>read(second, "$.toolResults[0].items[*].evidenceId"))
                .containsExactly("F" + changeId, CUR + "#B5");
        assertThat(JsonPath.<List<String>>read(second, "$.toolResults[0].items[*].grade"))
                .containsExactly("RELATED", "RELATED");
        // 교차 검증이 인용을 계정과 짝짓도록 요약 줄·인용 줄 모두 changeId를 facts로 보낸다
        assertThat(JsonPath.<List<Integer>>read(second, "$.toolResults[0].items[*].facts.changeId"))
                .containsExactly((int) changeId, (int) changeId);
        assertThat(JsonPath.<List<Object>>read(second, "$.toolResults[0].items[*].facts.direction")).isEmpty();
    }

    @Test
    @DisplayName("확인 액션은 이 분석의 변경·이 채팅의 질문·이 기업일 때만 남기고, 분석 ID는 backend가 채운다")
    void confirmActionsAreChecked() throws Exception {
        long changeId = financialChangeId();
        AI.on(STEPS, Reply.ok(finalAnswer("NOT_FOUND", null, "",
                "{\"type\":\"CONFIRM_SAVE_NOTE\",\"note\":{\"kind\":\"FINANCIAL_CHANGE\",\"changeId\":" + changeId
                        + ",\"memo\":\"  환율 확인  \"}},"
                        + "{\"type\":\"CONFIRM_SAVE_NOTE\",\"note\":{\"kind\":\"TEXT_CHANGE\",\"changeId\":999999}},"
                        + "{\"type\":\"CONFIRM_SAVE_NOTE\",\"note\":{\"kind\":\"ANSWER_CITATION\",\"questionId\":7,"
                        + "\"citationNo\":1}},"
                        + "{\"type\":\"CONFIRM_SAVE_NOTE\",\"note\":{\"kind\":\"TEXT_CHANGE\",\"changeId\":"
                        + lawsuitChangeId + ",\"memo\":\"" + "가".repeat(1001) + "\"}},"
                        + "{\"type\":\"CONFIRM_FAVORITE\"},"
                        + "{\"type\":\"CONFIRM_FAVORITE\",\"corpCode\":\"99999999\"}")));

        chat("이 계정 노트에 담고 관심 기업에도 넣어줘")
                .andExpect(jsonPath("$.actions", hasSize(2)))
                .andExpect(jsonPath("$.actions[0].type").value("CONFIRM_SAVE_NOTE"))
                .andExpect(jsonPath("$.actions[0].note.kind").value("FINANCIAL_CHANGE"))
                .andExpect(jsonPath("$.actions[0].note.analysisId").value(analysisId))
                .andExpect(jsonPath("$.actions[0].note.changeId").value(changeId))
                .andExpect(jsonPath("$.actions[0].note.memo").value("환율 확인"))
                .andExpect(jsonPath("$.actions[1].type").value("CONFIRM_FAVORITE"))
                .andExpect(jsonPath("$.actions[1].label").value("관심 기업에 추가"))
                .andExpect(jsonPath("$.actions[1].corpCode").value("00000001"));
        // 관심 기업 액션은 고유번호를 LLM이 정하지 않는다(ai-server 요청에 고유번호가 없음)
        String request = AI.requests(STEPS).getFirst().bodyText();
        assertThat(JsonPath.<List<String>>read(request,
                "$.actions[?(@.type == 'CONFIRM_FAVORITE')].parameters.required[*]")).isEmpty();
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM judgment_note_item", Integer.class)).isZero();
    }

    @Test
    @DisplayName("저장된 노트의 메모는 ai-server로 보내지 않는다")
    void savedNoteMemoIsNotSentToAiServer() throws Exception {
        jdbcTemplate.update("INSERT INTO app_user (created_at, updated_at) VALUES (CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)");
        long userId = jdbcTemplate.queryForObject("SELECT MAX(id) FROM app_user", Long.class);
        noteService.create(userId, new NoteCreateRequest(NoteKind.FINANCIAL_CHANGE, analysisId, financialChangeId(),
                null, null, "아무도 모르는 비밀 메모"));
        AI.on(STEPS, twoSteps("{\"callId\":\"c1\",\"name\":\"get_summary\",\"arguments\":{}}",
                request -> finalAnswer("NOT_FOUND", null, "", "")));

        chat("영업이익 노트 보여줘").andExpect(status().isOk());

        assertThat(AI.requests(STEPS)).allSatisfy(r -> assertThat(r.bodyText()).doesNotContain("비밀 메모"));
    }

    @Test
    @DisplayName("재무 Tool로 먼저 받은 계정 근거에도 뒤에 받은 요약의 설명 등급이 붙는다")
    void summaryGradeIsAddedToEarlierFinancialEvidence() throws Exception {
        long changeId = financialChangeId();
        AI.on(STEPS, request -> {
            List<?> results = JsonPath.read(request.bodyText(), "$.toolResults");
            return Reply.ok(switch (results.size()) {
                case 0 -> toolCalls("{\"callId\":\"c1\",\"name\":\"get_financial_changes\",\"arguments\":{}}");
                case 1 -> toolCalls("{\"callId\":\"c2\",\"name\":\"get_summary\",\"arguments\":{}}");
                default -> finalAnswer("ANSWERED", "영업이익이 줄었어요[F" + changeId + "].", "\"F" + changeId + "\"", "");
            });
        });

        chat("영업이익은 왜 줄었어?")
                .andExpect(jsonPath("$.citations[0].kind").value("FINANCIAL_CHANGE"))
                .andExpect(jsonPath("$.citations[0].accountName").value("영업이익"))
                .andExpect(jsonPath("$.citations[0].grade").value("RELATED"));
    }

    @Test
    @DisplayName("요약 인용 위치가 원문 블록 ID가 아니면 그 인용만 빼고 요약 Tool은 답한다")
    void summaryToolSkipsMalformedQuoteEvidenceId() throws Exception {
        jdbcTemplate.update("UPDATE summary_item SET quote_evidence_id = ? WHERE analysis_id = ?", CUR + "#Bx",
                analysisId);
        long changeId = financialChangeId();
        AI.on(STEPS, twoSteps("{\"callId\":\"c1\",\"name\":\"get_summary\",\"arguments\":{}}",
                request -> finalAnswer("ANSWERED", "영업이익이 줄었어요[F" + changeId + "].", "\"F" + changeId + "\"", "")));

        chat("요약해 줘")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ANSWERED"));

        String second = AI.requests(STEPS).get(1).bodyText();
        assertThat(JsonPath.<List<String>>read(second, "$.toolResults[0].items[*].evidenceId"))
                .containsExactly("F" + changeId);
    }

    @Test
    @DisplayName("AI 한 줄 풀이를 먼저 받아도 문장 변경 근거의 미리보기는 원문이고, 뒤에 받은 조회 Tool의 위치가 채워진다")
    void explanationFirstKeepsSourceQuoteAndLocation() throws Exception {
        AI.on("/internal/summaries", request -> Reply.ok("""
                {"promptVersion":"summary-2","model":"fake-model","generatedAt":"2026-11-03T09:40:11","items":[
                 {"ref":"%s","kind":"TEXT","status":"OK","sentence":"현재 보고서에 특허 소송이 새로 적혔어요.",
                  "evidenceIds":["%s#B5"],"reviewReason":null,"blockedRules":[]}],
                 "calls":[%s]}
                """.formatted(JsonPath.<String>read(request.bodyText(), "$.textItems[0].ref"), CUR,
                CALL.formatted("summary"))));
        String changeArgs = "{\"changeId\":" + lawsuitChangeId + "}";
        AI.on(STEPS, request -> {
            List<?> results = JsonPath.read(request.bodyText(), "$.toolResults");
            return Reply.ok(switch (results.size()) {
                case 0 -> toolCalls("{\"callId\":\"c1\",\"name\":\"explain_text_change\",\"arguments\":"
                        + changeArgs + "}");
                case 1 -> toolCalls("{\"callId\":\"c2\",\"name\":\"get_text_change\",\"arguments\":"
                        + changeArgs + "}");
                default -> finalAnswer("ANSWERED", "특허 소송이 새로 적혔어요[T" + lawsuitChangeId + "].",
                        "\"T" + lawsuitChangeId + "\"", "");
            });
        });

        chat("이 문장 무슨 뜻이야?")
                .andExpect(jsonPath("$.citations[0].kind").value("TEXT_CHANGE"))
                .andExpect(jsonPath("$.citations[0].quote").value("당사는 특허 침해 소송을 제기받았습니다."))
                .andExpect(jsonPath("$.citations[0].changeType").value("ADDED"))
                .andExpect(jsonPath("$.citations[0].sectionPath")
                        .value("XI. 그 밖에 투자자 보호를 위하여 필요한 사항 > 2. 우발부채 등에 관한 사항"));
    }
}
