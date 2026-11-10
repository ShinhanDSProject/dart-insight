package com.dartinsight.activity.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dartinsight.aiserver.client.AiServerPaths;
import com.dartinsight.aiserver.client.FakeAiServer;
import com.dartinsight.aiserver.client.FakeAiServer.Reply;
import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.domain.TextChangeListing;
import com.dartinsight.analysis.domain.TextChangeRow;
import com.dartinsight.analysis.domain.TextChangeRow.Side;
import com.dartinsight.analysis.domain.TextComparison;
import com.dartinsight.analysis.domain.TextStatus;
import com.dartinsight.analysis.repository.AnalysisRepository;
import com.dartinsight.analysis.service.AnalysisResultService;
import com.dartinsight.company.service.CompanyImportService;
import com.dartinsight.comparison.domain.ComparisonBasis;
import com.dartinsight.dart.domain.CorpCodeEntry;
import com.dartinsight.financial.domain.FsDiv;
import com.dartinsight.report.domain.Correction;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.domain.ReportNameParser.ParsedReportName;
import com.dartinsight.report.domain.ReportType;
import com.dartinsight.report.repository.ReportRepository;
import com.dartinsight.support.TestData;
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

/** 두 보고서 사이 활동과 앞으로의 영향(ADR-0067): GET /api/analyses/{analysisId}/activities, 가짜 AI 서버 */
@SpringBootTest
@AutoConfigureMockMvc
class PeriodActivityApiTest {

    static final FakeAiServer AI = new FakeAiServer();
    private static final String CUR = "20260814000001";
    private static final String PREV = "20250814000001";
    private static final String CONTRACT_PATH = "II. 사업의 내용 > 6. 주요계약 및 연구개발활동";
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 11, 10, 9, 0);
    private static final String CALL = """
            {"task":"period_activity","provider":"fake","model":"fake-model","promptVersion":"period-activity-1",
             "calledAt":"2026-11-10T10:12:03+09:00","traceId":"t","inputTokens":100,"outputTokens":50,
             "cachedInputTokens":null,"reasoningTokens":null,"latencyMs":10,"attempt":1,"outcome":"OK","error":null}""";
    private static final String QUOTE = "{\"quote\":\"이번 글 11\",\"evidenceId\":\"" + CUR + "#B11\"}";
    private static final String ITEM = """
            {"area":"BUSINESS","audiences":["INVESTOR","CAREER"],"title":"공급계약","summary":"공급계약을 맺었어요.",
             "facts":[%s],"signal":"POSITIVE","holdReason":null,"signalKind":"MAJOR_CONTRACT",
             "signalKindName":"주요 계약","signalChange":"NEW_SUPPLY","signalChangeName":"신규 공급 계약",
             "signalEvidenceId":"%s#B11",
             "impacts":[{"kind":"OUTLOOK","tone":"GOOD","text":"발주가 이어지면 매출을 받치는 쪽으로 작용할 수 있어요.",
                         "premises":[%s]},
                        {"kind":"CHECK","tone":null,"text":"계약 이행 금액을 확인해 보세요.","premises":[]}],
             "changeNos":[1]}""".formatted(QUOTE, CUR, QUOTE);

    @DynamicPropertySource
    static void servers(DynamicPropertyRegistry registry) {
        registry.add("app.ai-server.base-url", AI::baseUrl);
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
    private AnalysisResultService resultService;

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
        analysisId = completedAnalysis(TextStatus.COMPLETED, List.of(
                change("CONTRACT", "MAIN", 11), change(null, "FORMATTING", 12)));
    }

    private Long completedAnalysis(TextStatus textStatus, List<TextChangeRow> rows) {
        Analysis analysis = Analysis.request("00000001", CUR, PREV, ComparisonBasis.YOY, null, NOW);
        analysis.start(NOW);
        analysis.recordFsDiv(FsDiv.CFS);
        Long id = analysisRepository.save(analysis).getId();
        resultService.saveAndComplete(id, List.of(), new TextComparison(textStatus, null, rows));
        return id;
    }

    private static TextChangeRow change(String field, String group, int blockNo) {
        return new TextChangeRow(TextChangeRow.MODIFIED, "PARAGRAPH", false, "MATCHED", "제목", CONTRACT_PATH,
                new Side(PREV, 5, blockNo + 100, "이전 글 " + blockNo), new Side(CUR, 5, blockNo, "이번 글 " + blockNo),
                null, null, null, null, new TextChangeListing(group, field, false, null, null, "list-1"));
    }

    private static String generated(String items, String overviewIds) {
        return """
                {"promptVersion":"period-activity-1","expressionRulesVersion":"expr-1",
                 "signalTableVersion":"signal-table-2","model":"fake-model","generatedAt":"2026-11-10T10:12:03+09:00",
                 "status":"GENERATED","overview":{"text":"공급계약을 맺었어요.","evidenceIds":[%s]},
                 "items":[%s],"droppedCount":0,"candidateCount":1,"reviewReason":null,"blockedRules":[],
                 "calls":[%s]}""".formatted(overviewIds, items, CALL);
    }

    private String path() {
        return "/api/analyses/" + analysisId + "/activities";
    }

    private Long changeId(int blockNo) {
        return jdbcTemplate.queryForObject("SELECT id FROM text_change WHERE analysis_id = ? AND current_block_no = ?",
                Long.class, analysisId, blockNo);
    }

    @Test
    @DisplayName("처음 열면 후보가 될 수 있는 변경만 AI 서버에 보내고, 근거 위치를 붙여 저장한 카드를 돌려준다")
    void generatesAndStoresCardsWithEvidence() throws Exception {
        AI.on(AiServerPaths.PERIOD_ACTIVITIES, Reply.ok(generated(ITEM, "\"" + CUR + "#B11\"")));

        mockMvc.perform(get(path()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("GENERATED"))
                .andExpect(jsonPath("$.reason").value(nullValue()))
                .andExpect(jsonPath("$.overview.evidence[0].side").value("CURRENT"))
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].no").value(1))
                .andExpect(jsonPath("$.items[0].signal").value("POSITIVE"))
                .andExpect(jsonPath("$.items[0].audiences", contains("INVESTOR", "CAREER")))
                .andExpect(jsonPath("$.items[0].facts[0].evidence.rceptNo").value(CUR))
                .andExpect(jsonPath("$.items[0].facts[0].evidence.blockNo").value(11))
                .andExpect(jsonPath("$.items[0].facts[0].evidence.changeId").value(changeId(11)))
                .andExpect(jsonPath("$.items[0].impacts[0].kind").value("OUTLOOK"))
                .andExpect(jsonPath("$.items[0].impacts[0].tone").value("GOOD"))
                .andExpect(jsonPath("$.items[0].impacts[1].premises", hasSize(0)))
                .andExpect(jsonPath("$.items[0].changeIds", contains(changeId(11).intValue())))
                .andExpect(jsonPath("$.candidateCount").value(1))
                .andExpect(jsonPath("$.aiGenerated").value(true))
                .andExpect(jsonPath("$.ai.promptVersion").value("period-activity-1"));

        String body = AI.requests(AiServerPaths.PERIOD_ACTIVITIES).getFirst().bodyText();
        assertThat(body).contains("\"currentEvidenceId\":\"" + CUR + "#B11\"").doesNotContain("#B12\"");
        assertThat(body).contains("\"companyName\":\"예시전자\"", "\"currentReportName\":\"반기보고서 (2026.06)\"");
        Integer calls = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM llm_call WHERE analysis_id = ? AND task = 'period_activity'", Integer.class,
                analysisId);
        assertThat(calls).isEqualTo(1);
    }

    @Test
    @DisplayName("저장한 결과가 있으면 AI 서버를 다시 부르지 않는다")
    void reusesStoredResult() throws Exception {
        AI.on(AiServerPaths.PERIOD_ACTIVITIES, Reply.ok(generated(ITEM, "\"" + CUR + "#B11\"")));
        mockMvc.perform(get(path())).andExpect(status().isOk());

        mockMvc.perform(get(path()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(1)));

        assertThat(AI.requests(AiServerPaths.PERIOD_ACTIVITIES)).hasSize(1);
    }

    @Test
    @DisplayName("보낸 원문이 아닌 근거를 댄 카드는 빼고, 남는 카드가 없으면 검토 필요다")
    void dropsCardsWithUnknownEvidence() throws Exception {
        String unknown = ITEM.replace(CUR + "#B11", CUR + "#B999");
        AI.on(AiServerPaths.PERIOD_ACTIVITIES, Reply.ok(generated(unknown, "\"" + CUR + "#B999\"")));

        mockMvc.perform(get(path()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REVIEW_NEEDED"))
                .andExpect(jsonPath("$.items", hasSize(0)))
                .andExpect(jsonPath("$.overview").value(nullValue()))
                .andExpect(jsonPath("$.droppedCount").value(1))
                .andExpect(jsonPath("$.message").isNotEmpty());
    }

    @Test
    @DisplayName("문장을 비교하지 못한 분석은 AI를 부르지 않고 NOT_AVAILABLE이다")
    void textNotComparedIsNotAvailable() throws Exception {
        analysisId = completedAnalysis(TextStatus.FAILED, List.of());

        mockMvc.perform(get(path()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NOT_AVAILABLE"))
                .andExpect(jsonPath("$.reason").value("TEXT_NOT_COMPARED"))
                .andExpect(jsonPath("$.aiGenerated").value(false));

        assertThat(AI.requests(AiServerPaths.PERIOD_ACTIVITIES)).isEmpty();
    }

    @Test
    @DisplayName("AI 서버가 후보가 없어 부르지 않았으면 저장하지 않고 EMPTY다")
    void emptyWithoutCallIsNotStored() throws Exception {
        AI.on(AiServerPaths.PERIOD_ACTIVITIES, Reply.ok("""
                {"promptVersion":"period-activity-1","status":"EMPTY","overview":null,"items":[],
                 "droppedCount":0,"candidateCount":0,"calls":[]}"""));

        mockMvc.perform(get(path()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("EMPTY"))
                .andExpect(jsonPath("$.aiGenerated").value(false));

        Integer rows = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM period_activity", Integer.class);
        assertThat(rows).isZero();
    }

    @Test
    @DisplayName("AI 서버를 쓸 수 없으면 503이고 저장하지 않는다")
    void aiUnavailableIs503() throws Exception {
        AI.on(AiServerPaths.PERIOD_ACTIVITIES, Reply.error(503, "AI_LLM_UNAVAILABLE", "LLM을 쓸 수 없어요."));

        mockMvc.perform(get(path()))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("AI_SERVER_UNAVAILABLE"));

        Integer rows = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM period_activity", Integer.class);
        assertThat(rows).isZero();
    }

    @Test
    @DisplayName("없는 분석은 404, 끝나지 않은 분석은 409다")
    void missingOrRunningAnalysis() throws Exception {
        mockMvc.perform(get("/api/analyses/999999/activities"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ANALYSIS_NOT_FOUND"));

        Analysis running = Analysis.request("00000001", CUR, PREV, ComparisonBasis.YOY, null, NOW);
        running.start(NOW);
        Long id = analysisRepository.save(running).getId();
        mockMvc.perform(get("/api/analyses/" + id + "/activities"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ANALYSIS_NOT_READY"));
    }
}
