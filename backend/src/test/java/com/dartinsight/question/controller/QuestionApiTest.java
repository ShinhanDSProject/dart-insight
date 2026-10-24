package com.dartinsight.question.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dartinsight.aiserver.client.FakeAiServer;
import com.dartinsight.aiserver.client.FakeAiServer.Reply;
import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.domain.CalcStatus;
import com.dartinsight.analysis.domain.FinancialChangeRow;
import com.dartinsight.analysis.domain.FinancialChangeRow.Evidence;
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
import com.dartinsight.support.TestData;
import com.jayway.jsonpath.JsonPath;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
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

/** 근거로 답하는 질문(3.10): POST·GET /api/analyses/{analysisId}/questions, 가짜 AI 서버(/internal/answers) */
@SpringBootTest
@AutoConfigureMockMvc
class QuestionApiTest {

    static final FakeAiServer AI = new FakeAiServer();
    static final String ANSWERS = "/internal/answers";
    static final String CUR = "20260814000001";
    static final String PREV = "20250814000001";
    static final String CUR_EVIDENCE = CUR + "#B3";
    static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 21, 9, 0);

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

    private Long analysisId;

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
        document(CUR, "매출액은 메모리 수요 회복으로 늘었습니다.");
        document(PREV, "매출액은 줄었습니다.");
        Analysis analysis = Analysis.request("00000001", CUR, PREV, ComparisonBasis.YOY, null, NOW);
        analysis.start(NOW);
        analysis.recordFsDiv(FsDiv.CFS);
        analysisId = analysisRepository.save(analysis).getId();
        resultService.saveAndComplete(analysisId, List.of(
                new FinancialChangeRow("IS", FsDiv.CFS, "ifrs-full_Revenue", "매출액", 0, AmountBasis.CUMULATIVE,
                        145_000_000_000_000L, 152_000_000_000_000L, 7_000_000_000_000L, new BigDecimal("0.048276"),
                        CalcStatus.OK, "KRW",
                        new Evidence(PREV, "IS", "ifrs-full_Revenue", "매출액", "제 56 기 반기"),
                        new Evidence(CUR, "IS", "ifrs-full_Revenue", "매출액", "제 57 기 반기"))));
    }

    private void document(String rceptNo, String explanation) {
        List<Section> sections = List.of(
                new Section(1, null, 1, "IV. 이사의 경영진단 및 분석의견", null, false,
                        List.of(new Block(1, "PARAGRAPH", "경영진단 개요입니다.", null))),
                new Section(2, 1, 2, "2. 영업실적", null, false, List.of(
                        new Block(2, "PARAGRAPH", "당사는 메모리를 만듭니다.", null),
                        new Block(3, "PARAGRAPH", explanation, null),
                        new Block(4, "TABLE", "매출액 | 100", null))));
        StructuredDocumentResponse response = new StructuredDocumentResponse(rceptNo, "dart-xml-1", "STRUCTURED",
                null, null, rceptNo + ".xml", "utf-8", "반기보고서", "예시전자", List.of(), List.of(),
                Map.of("cells", 0, "sourceCells", 0), sections);
        ReportDocument saved = documentRepository.save(ReportDocument.structured(rceptNo, response, 100, NOW, NOW));
        documentStore.replace(saved.getId(), sections);
    }

    private ResultActions ask(Long id, String question) throws Exception {
        String body = question == null ? "{}" : "{\"question\":\"" + question + "\"}";
        return mockMvc.perform(post("/api/analyses/{a}/questions", id)
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private static String answered(String answer, String evidenceIds, String factRefs) {
        return """
                {"promptVersion":"answer-1","expressionRulesVersion":"expr-1","model":"fake-model",
                 "generatedAt":"2026-10-24T10:12:03","status":"ANSWERED","answer":"%s",
                 "evidenceIds":[%s],"factRefs":[%s],"reviewReason":null,"blockedRules":[],
                 "calls":[{"task":"answer","provider":"fake","model":"fake-model","promptVersion":"answer-1",
                  "calledAt":"2026-10-24T10:12:02","traceId":"trace-q1","inputTokens":900,"outputTokens":120,
                  "latencyMs":800,"attempt":1,"outcome":"OK","error":null}]}
                """.formatted(answer, evidenceIds, factRefs);
    }

    private Long revenueChangeId() {
        return changeRepository.findByAnalysisIdOrderBySjDivAscDisplayOrderAsc(analysisId).getFirst().getId();
    }

    private int questionRows() {
        return jdbcTemplate.queryForObject("SELECT COUNT(*) FROM analysis_question", Integer.class);
    }

    @Test
    @DisplayName("질문이 비었거나 2자 미만·200자 초과면 400 errors[question]")
    void rejectsQuestionsOfWrongLength() throws Exception {
        for (String question : new String[] {null, "   ", " 가 ", "가".repeat(201)}) {
            ask(analysisId, question)
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"))
                    .andExpect(jsonPath("$.errors[0].field").value("question"));
        }
        assertThat(AI.requests(ANSWERS)).isEmpty();
        assertThat(questionRows()).isZero();
    }

    @Test
    @DisplayName("없는 분석은 404, 끝나지 않은 분석은 409")
    void unknownAnalysisIsNotFoundAndUnfinishedIsNotReady() throws Exception {
        ask(999_999L, "매출액은 왜 늘었나요?")
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ANALYSIS_NOT_FOUND"));
        mockMvc.perform(get("/api/analyses/{a}/questions", 999_999L))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ANALYSIS_NOT_FOUND"));

        Long running = analysisRepository.save(
                Analysis.request("00000001", CUR, PREV, ComparisonBasis.PREV, null, NOW)).getId();
        ask(running, "매출액은 왜 늘었나요?")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ANALYSIS_NOT_READY"));
        assertThat(AI.requests(ANSWERS)).isEmpty();
    }

    @Test
    @DisplayName("후보 문단도 사실도 없으면 AI 서버를 부르지 않고 NOT_FOUND로 저장한다")
    void answersNotFoundWithoutCallingAiServer() throws Exception {
        ask(analysisId, "배당 정책은 어떻게 되나요?")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NOT_FOUND"))
                .andExpect(jsonPath("$.answer").doesNotExist())
                .andExpect(jsonPath("$.message").value("두 보고서에서 질문과 관련된 문단이나 수치를 찾지 못했어요. "
                        + "다른 말로 물어보거나 문장·내용 변화에서 검색해 보세요."))
                .andExpect(jsonPath("$.citations", hasSize(0)))
                .andExpect(jsonPath("$.facts", hasSize(0)))
                .andExpect(jsonPath("$.ai").doesNotExist())
                .andExpect(jsonPath("$.questionId").isNumber())
                .andExpect(jsonPath("$.question").value("배당 정책은 어떻게 되나요?"));
        assertThat(AI.requests(ANSWERS)).isEmpty();
        assertThat(questionRows()).isEqualTo(1);
    }

    @Test
    @DisplayName("답의 근거 ID는 [1]로, 사실은 [F1]로 보이고 인용 위치와 함께 저장된다")
    void answerCitesSourcesByNumberAndFactsByRef() throws Exception {
        AI.on(ANSWERS, Reply.ok(answered(
                "회사는 메모리 수요 회복으로 매출이 늘었다고 밝혔어요[" + CUR_EVIDENCE + "]. "
                        + "매출액은 145조 원에서 152조 원으로 늘었어요[F1].",
                "\"" + CUR_EVIDENCE + "\"", "\"F1\"")));

        ask(analysisId, "  매출액은 왜 늘었나요?  ")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.question").value("매출액은 왜 늘었나요?"))
                .andExpect(jsonPath("$.status").value("ANSWERED"))
                .andExpect(jsonPath("$.answer").value(
                        "회사는 메모리 수요 회복으로 매출이 늘었다고 밝혔어요[1]. 매출액은 145조 원에서 152조 원으로 늘었어요[F1]."))
                .andExpect(jsonPath("$.message").doesNotExist())
                .andExpect(jsonPath("$.citations", hasSize(1)))
                .andExpect(jsonPath("$.citations[0].no").value(1))
                .andExpect(jsonPath("$.citations[0].evidenceId").value(CUR_EVIDENCE))
                .andExpect(jsonPath("$.citations[0].side").value("current"))
                .andExpect(jsonPath("$.citations[0].rceptNo").value(CUR))
                .andExpect(jsonPath("$.citations[0].reportName").value("반기보고서 (2026.06)"))
                .andExpect(jsonPath("$.citations[0].sectionNo").value(2))
                .andExpect(jsonPath("$.citations[0].blockNo").value(3))
                .andExpect(jsonPath("$.citations[0].sectionPath").value("IV. 이사의 경영진단 및 분석의견 > 2. 영업실적"))
                .andExpect(jsonPath("$.citations[0].quote").value("매출액은 메모리 수요 회복으로 늘었습니다."))
                .andExpect(jsonPath("$.facts", hasSize(1)))
                .andExpect(jsonPath("$.facts[0].ref").value("F1"))
                .andExpect(jsonPath("$.facts[0].changeId").value(revenueChangeId()))
                .andExpect(jsonPath("$.facts[0].sjDiv").value("IS"))
                .andExpect(jsonPath("$.facts[0].accountName").value("매출액"))
                .andExpect(jsonPath("$.facts[0].sentence").value("매출액이 145조 원에서 152조 원으로 늘었어요(+4.8%)."))
                .andExpect(jsonPath("$.ai.model").value("fake-model"))
                .andExpect(jsonPath("$.ai.promptVersion").value("answer-1"))
                .andExpect(jsonPath("$.ai.generatedAt").value("2026-10-24T10:12:03"));

        // AI 서버에 보낸 것: 두 보고서의 후보 문단(현재 먼저)과 코드가 만든 사실 문장
        String sent = AI.requests(ANSWERS).getFirst().bodyText();
        assertThat(JsonPath.<String>read(sent, "$.companyName")).isEqualTo("예시전자");
        assertThat(JsonPath.<String>read(sent, "$.currentReport")).isEqualTo("반기보고서 (2026.06)");
        assertThat(JsonPath.<String>read(sent, "$.previousReport")).isEqualTo("반기보고서 (2025.06)");
        assertThat(JsonPath.<List<String>>read(sent, "$.sources[*].evidenceId"))
                .containsExactly(CUR_EVIDENCE, PREV + "#B3");
        assertThat(JsonPath.<List<String>>read(sent, "$.sources[*].side")).containsExactly("current", "previous");
        assertThat(JsonPath.<String>read(sent, "$.facts[0].sentence"))
                .isEqualTo("매출액이 145조 원에서 152조 원으로 늘었어요(+4.8%).");

        Map<String, Object> stored = jdbcTemplate.queryForMap("SELECT * FROM analysis_question");
        assertThat(stored.get("evidence_ids")).isEqualTo(CUR_EVIDENCE);
        assertThat(stored.get("fact_change_ids")).isEqualTo(String.valueOf(revenueChangeId()));
        assertThat(stored.get("model")).isEqualTo("fake-model");
        assertThat(stored.get("trace_id")).isNotNull();
        Map<String, Object> call = jdbcTemplate.queryForMap("SELECT * FROM llm_call");
        assertThat(call.get("task")).isEqualTo("answer");
        assertThat(call.get("analysis_id")).isEqualTo(analysisId);
        assertThat(call.get("trace_id")).isEqualTo("trace-q1");
    }

    @Test
    @DisplayName("보낸 적 없는 근거 ID를 인용한 답은 쓰지 않고 REVIEW_NEEDED")
    void answerCitingUnknownEvidenceNeedsReview() throws Exception {
        AI.on(ANSWERS, Reply.ok(answered("매출이 늘었어요[" + CUR + "#B999].", "\"" + CUR + "#B999\"", "")));

        ask(analysisId, "매출액은 왜 늘었나요?")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REVIEW_NEEDED"))
                .andExpect(jsonPath("$.answer").doesNotExist())
                .andExpect(jsonPath("$.message").value(
                        "근거를 확인하지 못해 답을 보여 주지 않아요. 질문을 바꾸거나 원문에서 직접 확인해 주세요."))
                .andExpect(jsonPath("$.citations", hasSize(0)))
                .andExpect(jsonPath("$.ai").doesNotExist());
    }

    @Test
    @DisplayName("AI 서버가 OUT_OF_SCOPE로 답하면 그대로 안내한다")
    void outOfScopeIsPassedThrough() throws Exception {
        AI.on(ANSWERS, Reply.ok("""
                {"promptVersion":"answer-1","expressionRulesVersion":"expr-1","model":null,"generatedAt":null,
                 "status":"OUT_OF_SCOPE","answer":null,"evidenceIds":[],"factRefs":[],"reviewReason":null,
                 "blockedRules":[],"calls":[]}
                """));

        ask(analysisId, "매출액이 늘었는데 지금 매수해도 되나요?")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OUT_OF_SCOPE"))
                .andExpect(jsonPath("$.answer").doesNotExist())
                .andExpect(jsonPath("$.message").value(
                        "투자 판단·주가 예측을 돕는 질문에는 답하지 않아요. 공시에 적힌 사실을 물어봐 주세요."))
                .andExpect(jsonPath("$.ai").doesNotExist());
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM llm_call", Integer.class)).isZero();
    }

    @Test
    @DisplayName("AI 서버나 LLM을 쓸 수 없으면 503 AI_SERVER_UNAVAILABLE이고 저장하지 않는다")
    void aiServerFailureIsServiceUnavailable() throws Exception {
        AI.on(ANSWERS, Reply.error(503, "AI_LLM_UNAVAILABLE", "LLM을 쓸 수 없어요."));

        ask(analysisId, "매출액은 왜 늘었나요?")
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("AI_SERVER_UNAVAILABLE"));
        assertThat(questionRows()).isZero();
    }

    @Test
    @DisplayName("기록은 최신 순이고, 저장된 근거 ID·사실로 인용을 다시 만든다")
    void historyIsNewestFirstWithRebuiltCitations() throws Exception {
        AI.on(ANSWERS, Reply.ok(answered("매출이 늘었다고 밝혔어요[" + CUR_EVIDENCE + "]. 매출액이 늘었어요[F1].",
                "\"" + CUR_EVIDENCE + "\"", "\"F1\"")));
        ask(analysisId, "매출액은 왜 늘었나요?").andExpect(status().isOk());
        ask(analysisId, "배당 정책은 어떻게 되나요?").andExpect(status().isOk());

        mockMvc.perform(get("/api/analyses/{a}/questions", analysisId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.items[0].question").value("배당 정책은 어떻게 되나요?"))
                .andExpect(jsonPath("$.items[0].status").value("NOT_FOUND"))
                .andExpect(jsonPath("$.items[1].status").value("ANSWERED"))
                .andExpect(jsonPath("$.items[1].answer").value("매출이 늘었다고 밝혔어요[1]. 매출액이 늘었어요[F1]."))
                .andExpect(jsonPath("$.items[1].citations[0].no").value(1))
                .andExpect(jsonPath("$.items[1].citations[0].evidenceId").value(CUR_EVIDENCE))
                .andExpect(jsonPath("$.items[1].citations[0].reportName").value("반기보고서 (2026.06)"))
                .andExpect(jsonPath("$.items[1].citations[0].sectionNo").value(2))
                .andExpect(jsonPath("$.items[1].citations[0].sectionPath")
                        .value("IV. 이사의 경영진단 및 분석의견 > 2. 영업실적"))
                .andExpect(jsonPath("$.items[1].citations[0].quote").value("매출액은 메모리 수요 회복으로 늘었습니다."))
                .andExpect(jsonPath("$.items[1].facts[0].ref").value("F1"))
                .andExpect(jsonPath("$.items[1].facts[0].changeId").value(revenueChangeId()))
                .andExpect(jsonPath("$.items[1].ai.model").value("fake-model"));
    }

    private ResultActions feedback(Long id, Long questionId, String body) throws Exception {
        return mockMvc.perform(put("/api/analyses/{a}/questions/{q}/feedback", id, questionId)
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    /** 답한(ANSWERED) 질문을 하나 만들고 id를 돌려준다 */
    private Long answeredQuestion() throws Exception {
        AI.on(ANSWERS, Reply.ok(answered("매출이 늘었다고 밝혔어요[" + CUR_EVIDENCE + "].",
                "\"" + CUR_EVIDENCE + "\"", "")));
        String body = ask(analysisId, "매출액은 왜 늘었나요?")
                .andExpect(jsonPath("$.status").value("ANSWERED"))
                .andExpect(jsonPath("$.feedback").doesNotExist())
                .andReturn().getResponse().getContentAsString();
        return JsonPath.<Number>read(body, "$.questionId").longValue();
    }

    private Map<String, Object> storedFeedback(Long questionId) {
        return jdbcTemplate.queryForMap("SELECT feedback_helpful, feedback_reason, feedback_at "
                + "FROM analysis_question WHERE id = ?", questionId);
    }

    @Test
    @DisplayName("도움이 됐다는 평가를 저장하고 기록에 보여 준다")
    void savesHelpfulFeedbackAndShowsItInHistory() throws Exception {
        Long questionId = answeredQuestion();

        feedback(analysisId, questionId, "{\"helpful\":true}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.questionId").value(questionId))
                .andExpect(jsonPath("$.helpful").value(true))
                .andExpect(jsonPath("$.reason").doesNotExist())
                .andExpect(jsonPath("$.updatedAt").isString());

        Map<String, Object> stored = storedFeedback(questionId);
        assertThat(stored.get("feedback_helpful")).isEqualTo(true);
        assertThat(stored.get("feedback_reason")).isNull();
        assertThat(stored.get("feedback_at")).isNotNull();
        mockMvc.perform(get("/api/analyses/{a}/questions", analysisId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].feedback.helpful").value(true))
                .andExpect(jsonPath("$.items[0].feedback.reason").doesNotExist());
    }

    @Test
    @DisplayName("도움이 안 됐다는 평가는 사유와 함께 저장하고, 다시 보내면 마지막 값으로 바뀐다")
    void savesNotHelpfulFeedbackWithReasonAndOverwritesIt() throws Exception {
        Long questionId = answeredQuestion();

        feedback(analysisId, questionId, "{\"helpful\":false}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.helpful").value(false))
                .andExpect(jsonPath("$.reason").doesNotExist());
        feedback(analysisId, questionId, "{\"helpful\":false,\"reason\":\"WRONG_SOURCE\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.helpful").value(false))
                .andExpect(jsonPath("$.reason").value("WRONG_SOURCE"));
        mockMvc.perform(get("/api/analyses/{a}/questions", analysisId))
                .andExpect(jsonPath("$.items[0].feedback.helpful").value(false))
                .andExpect(jsonPath("$.items[0].feedback.reason").value("WRONG_SOURCE"));

        feedback(analysisId, questionId, "{\"helpful\":true,\"reason\":null}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.helpful").value(true));
        Map<String, Object> stored = storedFeedback(questionId);
        assertThat(stored.get("feedback_helpful")).isEqualTo(true);
        assertThat(stored.get("feedback_reason")).isNull();
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM analysis_question", Integer.class))
                .isEqualTo(1);
    }

    @Test
    @DisplayName("helpful이 없거나, 도움이 됐는데 사유가 있거나, 모르는 사유면 400이고 저장하지 않는다")
    void rejectsInvalidFeedbackBodies() throws Exception {
        Long questionId = answeredQuestion();

        feedback(analysisId, questionId, "{}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"))
                .andExpect(jsonPath("$.errors[0].field").value("helpful"));
        feedback(analysisId, questionId, "{\"helpful\":true,\"reason\":\"OTHER\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"))
                .andExpect(jsonPath("$.errors[0].field").value("reason"));
        feedback(analysisId, questionId, "{\"helpful\":false,\"reason\":\"BORING\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("reason"));
        feedback(analysisId, questionId, "not json")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"));
        assertThat(storedFeedback(questionId).get("feedback_helpful")).isNull();
    }

    @Test
    @DisplayName("답하지 않은(ANSWERED가 아닌) 질문을 평가하면 400")
    void rejectsFeedbackOnUnansweredQuestion() throws Exception {
        String body = ask(analysisId, "배당 정책은 어떻게 되나요?")
                .andExpect(jsonPath("$.status").value("NOT_FOUND"))
                .andReturn().getResponse().getContentAsString();
        Long questionId = JsonPath.<Number>read(body, "$.questionId").longValue();

        feedback(analysisId, questionId, "{\"helpful\":false,\"reason\":\"NOT_ANSWERED\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"))
                .andExpect(jsonPath("$.message").value("답한 질문만 평가할 수 있어요."))
                .andExpect(jsonPath("$.errors", hasSize(0)));
        assertThat(storedFeedback(questionId).get("feedback_helpful")).isNull();
    }

    @Test
    @DisplayName("없는 분석은 ANALYSIS_NOT_FOUND, 없는 질문이나 다른 분석의 질문은 ANALYSIS_QUESTION_NOT_FOUND")
    void unknownQuestionOrQuestionOfAnotherAnalysisIsNotFound() throws Exception {
        Long questionId = answeredQuestion();
        Long other = analysisRepository.save(
                Analysis.request("00000001", CUR, PREV, ComparisonBasis.PREV, null, NOW)).getId();

        feedback(999_999L, questionId, "{\"helpful\":true}")
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ANALYSIS_NOT_FOUND"));
        feedback(analysisId, 999_999L, "{\"helpful\":true}")
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ANALYSIS_QUESTION_NOT_FOUND"));
        feedback(other, questionId, "{\"helpful\":true}")
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ANALYSIS_QUESTION_NOT_FOUND"));
        assertThat(storedFeedback(questionId).get("feedback_helpful")).isNull();
    }
}
