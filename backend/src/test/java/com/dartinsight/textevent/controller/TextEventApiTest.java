package com.dartinsight.textevent.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dartinsight.aiserver.client.AiServerPaths;
import com.dartinsight.aiserver.client.FakeAiServer;
import com.dartinsight.aiserver.client.FakeAiServer.Reply;
import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.domain.CalcStatus;
import com.dartinsight.analysis.domain.FinancialChangeRow;
import com.dartinsight.analysis.domain.FinancialChangeRow.Evidence;
import com.dartinsight.analysis.domain.TextChangeListing;
import com.dartinsight.analysis.domain.TextChangeListing.RowDiff;
import com.dartinsight.analysis.domain.TextChangeRow;
import com.dartinsight.analysis.domain.TextChangeRow.Side;
import com.dartinsight.analysis.domain.TextComparison;
import com.dartinsight.analysis.domain.TextStatus;
import com.dartinsight.analysis.repository.AnalysisRepository;
import com.dartinsight.analysis.service.AnalysisResultService;
import com.dartinsight.company.service.CompanyImportService;
import com.dartinsight.comparison.domain.AmountBasis;
import com.dartinsight.comparison.domain.ComparisonBasis;
import com.dartinsight.dart.client.DisclosureListJson;
import com.dartinsight.dart.client.FakeOpenDartServer;
import com.dartinsight.dart.client.FakeOpenDartServer.Response;
import com.dartinsight.dart.domain.CorpCodeEntry;
import com.dartinsight.financial.domain.FsDiv;
import com.dartinsight.report.domain.Correction;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.domain.ReportNameParser.ParsedReportName;
import com.dartinsight.report.domain.ReportType;
import com.dartinsight.report.repository.ReportRepository;
import com.dartinsight.support.TestData;
import com.dartinsight.textevent.domain.TextEventRun;
import com.dartinsight.textevent.domain.TextEvents;
import com.dartinsight.textevent.repository.TextEventRunRepository;
import com.dartinsight.textevent.service.TextEventRunner;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Base64;
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

/** 주요 사건 실행·조회 API(3.36, ADR-0050, docs/api-spec.md). 분석 상태와 text-changes에 영향이 없는지도 본다. */
@SpringBootTest(properties = "app.text-events.enabled=true")
@AutoConfigureMockMvc
class TextEventApiTest {

    private static final FakeAiServer AI = new FakeAiServer();
    private static final FakeOpenDartServer DART = startDart();
    private static final String CUR = "20260814000001";
    private static final String PREV = "20250814000001";
    private static final String LAWSUIT_PATH = "XI. 그 밖에 투자자 보호를 위하여 필요한 사항 > 2. 우발부채 등에 관한 사항";
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 11, 5, 9, 0);
    private static final String CALL = """
            {"task":"text_event","provider":"openai","model":"m","promptVersion":"text-event-2",
             "calledAt":"2026-11-05T10:13:01","traceId":"evt-1","inputTokens":10,"outputTokens":5,
             "latencyMs":100,"attempt":1,"outcome":"OK","error":null}""";
    private static final String MEANING = """
            {"status":"GENERATED","failReason":null,
             "items":[{"type":"FACT","absentTopics":[],"text":"패소 판결이 적혔어요.","evidenceIds":["%s#B11"]},
                      {"type":"ABSENT","absentTopics":["AMOUNT"],"text":"금액은 적혀 있지 않아요.",
                       "evidenceIds":["%s#B12"]}],
             "model":"m","promptVersion":"event-meaning-1","generatedAt":"2026-11-05T10:13:40"}"""
            .formatted(CUR, CUR);
    private static final String REASON = """
            {"status":"GENERATED","failReason":null,
             "items":[{"type":"REASON","text":"회사가 소송에서 졌다고 적혔어요.","evidenceIds":["%s#B11"]}],
             "model":"m","promptVersion":"event-signal-reason-1","generatedAt":"2026-11-05T10:13:52"}"""
            .formatted(CUR);
    private static final String EVENT = """
            {"sortOrder":1,"title":"소송 패소","kind":"소송","changeNos":[1,2],
             "quotes":[{"changeNo":1,"purpose":"CHANGE","side":"CURRENT","text":"패소","evidenceId":"%s#B11"}],
             "scaleAmount":12000000000,"scaleAmountText":"120억원","currency":"KRW",
             "scaleAmountKrw":12000000000,"scaleRatio":0.012,"scaleNotComputedReason":null,
             "scaleEvidenceId":"%s#B11","amountSource":"ai_choice","fxSource":null,"fxRateDate":null,
             "sortBasis":"AMOUNT","kindCode":"LITIGATION","changeCode":"LOST","changeName":"패소",
             "signal":"CAUTION","holdReason":null,"signalEvidenceId":"%s#B11",
             "rowCounts":{"changed":3,"added":0,"missing":0},
             "factAccounts":[{"accountType":null,"accountName":"충당 부채"}],
             "meaning":%s,"signalReason":%s,"glossary":[]}""".formatted(CUR, CUR, CUR, MEANING, REASON);
    /** 보류(좋은 면·나쁜 면)이고 신호 이유가 대체 표시인 두 번째 사건 */
    private static final String HOLD_EVENT = EVENT.replace("\"sortOrder\":1", "\"sortOrder\":2")
            .replace("소송 패소", "자기주식 취득")
            .replace("\"kindCode\":\"LITIGATION\",\"changeCode\":\"LOST\",\"changeName\":\"패소\"",
                    "\"kindCode\":\"TREASURY_STOCK\",\"changeCode\":\"ACQUIRED\",\"changeName\":\"취득\"")
            .replace("\"signal\":\"CAUTION\",\"holdReason\":null", "\"signal\":\"HOLD\",\"holdReason\":\"MIXED_SIDES\"")
            .replace("\"rowCounts\":{\"changed\":3,\"added\":0,\"missing\":0}", "\"rowCounts\":null")
            .replace("\"factAccounts\":[{\"accountType\":null,\"accountName\":\"충당 부채\"}]", "\"factAccounts\":[]")
            .replace(REASON, """
                    {"status":"FALLBACK","failReason":"BUDGET_EXCEEDED",
                     "items":[{"type":"GENERAL","text":"좋은 면","evidenceIds":[]},
                              {"type":"GENERAL","text":"나쁜 면","evidenceIds":[]}],
                     "model":null,"promptVersion":null,"generatedAt":null}""");
    private static final String TABLE = """
            {"version":"signal-table-2","signalNotice":"공시상 신호이며 투자 판단이 아니에요.",
             "kinds":[{"code":"LITIGATION","name":"소송","front":false,
                       "changes":[{"code":"LOST","name":"패소","signal":"CAUTION","explicitOnly":false,
                                   "general":"소송에서 진 것이라, 배상 부담이 생길 수 있어요."}],
                       "accounts":["충당부채"],"accountsByType":null,"generalSides":null},
                      {"code":"TREASURY_STOCK","name":"자기주식","front":false,
                       "changes":[{"code":"ACQUIRED","name":"취득","signal":"MIXED","explicitOnly":false,
                                   "general":null}],
                       "accounts":[],"accountsByType":null,"generalSides":{"good":"좋은 면","bad":"나쁜 면"}}],
             "glossary":[]}""";

    @DynamicPropertySource
    static void servers(DynamicPropertyRegistry registry) {
        registry.add("app.ai-server.base-url", AI::baseUrl);
        registry.add("app.opendart.base-url", DART::baseUrl);
        registry.add("app.opendart.read-timeout", () -> "2s");
        registry.add("app.opendart.max-retries", () -> "0");
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
    private AnalysisRepository analysisRepository;

    @Autowired
    private AnalysisResultService resultService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private TextEventRunRepository runRepository;

    @Autowired
    private TextEventRunner runner;

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
        DART.on("/api/list.json", Response.json(DisclosureListJson.NO_DATA));
        analysisId = completedAnalysis(TextStatus.COMPLETED, List.of(
                change("LITIGATION", "MAIN", "PARAGRAPH", 11, null),
                change("FUNDING", "MAIN", "TABLE", 12, new RowDiff("COMPARED", "구분",
                        new RowDiff.Counts(3, 0, 0, 2), null, List.of(), List.of(), List.of())),
                change("CONTRACT", "MAIN", "PARAGRAPH", 13, null),
                change(null, "FORMATTING", "PARAGRAPH", 14, null),
                change(null, "UNPAIRED", "PARAGRAPH", 15, null)));
    }

    private Long completedAnalysis(TextStatus textStatus, List<TextChangeRow> rows) {
        Analysis analysis = Analysis.request("00000001", CUR, PREV, ComparisonBasis.YOY, null, NOW);
        analysis.start(NOW);
        analysis.recordFsDiv(FsDiv.CFS);
        Long id = analysisRepository.save(analysis).getId();
        resultService.saveAndComplete(id, List.of(
                financial("IS", "충당부채", 0), financial("BS", "현금", 0), financial("BS", "충당부채", 1)),
                new TextComparison(textStatus, null, rows));
        return id;
    }

    /** 사실 칸은 이름이 같은 재무상태표 계정만 찾으므로 손익계산서의 같은 이름은 고르지 않아야 한다 */
    private static FinancialChangeRow financial(String sjDiv, String name, int order) {
        return new FinancialChangeRow(sjDiv, FsDiv.CFS, "NAME:" + name, name, order, AmountBasis.POINT,
                1_000L, 1_500L, 500L, new BigDecimal("0.500000"), CalcStatus.OK, "KRW",
                new Evidence(PREV, sjDiv, "NAME:" + name, name, "제 56 기 반기"),
                new Evidence(CUR, sjDiv, "NAME:" + name, name, "제 57 기 반기"));
    }

    private static TextChangeRow change(String field, String group, String blockType, int blockNo, RowDiff rowDiff) {
        return new TextChangeRow(TextChangeRow.MODIFIED, blockType, false, "MATCHED", "제목", LAWSUIT_PATH,
                new Side(PREV, 5, blockNo + 100, "이전 글 " + blockNo), new Side(CUR, 5, blockNo, "패소 글 " + blockNo),
                null, null, null, null,
                new TextChangeListing(group, field, false, null, rowDiff, "list-1"));
    }

    private static String created(String events, String unbound, int dropped) {
        return """
                {"created":true,"notCreatedReason":null,"model":"m","promptVersion":"text-event-4",
                 "signalTableVersion":"signal-table-2","generatedAt":"2026-11-05T10:13:02","droppedEventCount":%d,"events":[%s],
                 "unboundChangeNos":[%s],"calls":[%s]}""".formatted(dropped, events, unbound, CALL);
    }

    private static String notCreated(String reason) {
        return """
                {"created":false,"notCreatedReason":"%s","model":null,"promptVersion":"text-event-2",
                 "generatedAt":null,"droppedEventCount":0,"events":[],"unboundChangeNos":[],"calls":[]}"""
                .formatted(reason);
    }

    private String runsPath() {
        return "/api/analyses/" + analysisId + "/event-runs";
    }

    private String eventsPath() {
        return "/api/analyses/" + analysisId + "/events";
    }

    private int llmCallCount(String task) {
        Integer count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM llm_call WHERE analysis_id = ? AND task = ?",
                Integer.class, analysisId, task);
        return count == null ? 0 : count;
    }

    @Test
    @DisplayName("시작하면 기본 목록을 ai-server에 보내고, 저장한 뒤 사건 목록과 근거를 돌려준다")
    void startingSavesEventsAndListReturnsThem() throws Exception {
        AI.on(AiServerPaths.TEXT_EVENTS, Reply.ok(created(EVENT, "3", 0)));

        mockMvc.perform(post(runsPath()).header("X-Trace-Id", "evt-1"))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.eventVersion").value("event-4"));

        FakeAiServer.Request sent = AI.requests(AiServerPaths.TEXT_EVENTS).getFirst();
        assertThat(sent.traceId()).isEqualTo("evt-1");
        assertThat(sent.bodyText()).contains("\"changeNo\":1", "\"changeNo\":5", "\"reportBaseDate\":\"2026-06-30\"")
                .doesNotContain("\"changeNo\":4");
        assertThat(sent.bodyText()).contains("\"changedUnitCount\":3", "\"changedUnitCount\":1");

        mockMvc.perform(get(eventsPath()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.droppedEventCount").value(0))
                .andExpect(jsonPath("$.fieldCounts[*].field", contains("LITIGATION", "FUNDING")))
                .andExpect(jsonPath("$.fieldCounts[0].eventCount").value(1))
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].title").value("소송 패소"))
                .andExpect(jsonPath("$.items[0].fields", contains("LITIGATION", "FUNDING")))
                .andExpect(jsonPath("$.items[0].changeIds", hasSize(2)))
                .andExpect(jsonPath("$.items[0].quotes[0].evidenceId").value(CUR + "#B11"))
                .andExpect(jsonPath("$.items[0].quotes[0].sectionPath").value(LAWSUIT_PATH))
                .andExpect(jsonPath("$.items[0].scaleAmount").value(12000000000L))
                .andExpect(jsonPath("$.items[0].scaleRatio").value(0.012))
                .andExpect(jsonPath("$.items[0].amountSource").value("ai_choice"))
                .andExpect(jsonPath("$.items[0].sortBasis").value("AMOUNT"))
                .andExpect(jsonPath("$.items[0].aiGenerated").value(true))
                .andExpect(jsonPath("$.items[0].model").value("m"))
                .andExpect(jsonPath("$.items[0].promptVersion").value("text-event-4"))
                .andExpect(jsonPath("$.items[0].generatedAt").value("2026-11-05T10:13:02"))
                .andExpect(jsonPath("$.unboundChanges[0].field").value("CONTRACT"))
                .andExpect(jsonPath("$.unboundChanges[0].currentPreview").value("패소 글 13"));
        assertThat(llmCallCount("text_event")).isEqualTo(1);
    }

    @Test
    @DisplayName("사건 하나는 목록 항목에 묶인 변경을 더해 돌려주고, 다른 사건 번호는 404다")
    void eventDetailAddsChangesAndUnknownIdIsNotFound() throws Exception {
        AI.on(AiServerPaths.TEXT_EVENTS, Reply.ok(created(EVENT, "3", 0)));
        mockMvc.perform(post(runsPath()));
        Long eventId = jdbcTemplate.queryForObject("SELECT MAX(id) FROM text_event", Long.class);

        mockMvc.perform(get(eventsPath() + "/" + eventId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("소송 패소"))
                .andExpect(jsonPath("$.changes", hasSize(2)))
                .andExpect(jsonPath("$.changes[0].changeNo").value(1))
                .andExpect(jsonPath("$.changes[1].rowDiff.counts.changed").value(3));
        mockMvc.perform(get(eventsPath() + "/" + (eventId + 1)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ANALYSIS_EVENT_NOT_FOUND"));
    }

    @Test
    @DisplayName("시작을 다시 요청해도 완료된 실행을 돌려주고 ai-server를 또 부르지 않는다")
    void startingIsIdempotentAfterCompletion() throws Exception {
        AI.on(AiServerPaths.TEXT_EVENTS, Reply.ok(created(EVENT, "3", 0)));
        mockMvc.perform(post(runsPath()));

        mockMvc.perform(post(runsPath()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETED"));

        assertThat(AI.requests(AiServerPaths.TEXT_EVENTS)).hasSize(1);
    }

    @Test
    @DisplayName("시작하기 전 상태는 NOT_STARTED이고 목록은 409 ANALYSIS_EVENTS_NOT_READY다")
    void beforeStartStatusIsNotStartedAndListIsNotReady() throws Exception {
        mockMvc.perform(get(runsPath() + "/current"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NOT_STARTED"))
                .andExpect(jsonPath("$.startedAt").value(nullValue()));
        mockMvc.perform(get(eventsPath()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ANALYSIS_EVENTS_NOT_READY"));
    }

    @Test
    @DisplayName("LLM을 쓸 수 없으면 실행만 FAILED이고 분석과 text-changes는 그대로이며 호출 기록을 남긴다")
    void failureLeavesAnalysisAndTextChangesUsable() throws Exception {
        String header = Base64.getUrlEncoder().encodeToString(("[" + CALL.replace("\"OK\"", "\"ERROR\"") + "]")
                .getBytes(StandardCharsets.UTF_8));
        AI.on(AiServerPaths.TEXT_EVENTS, Reply.error(503, "AI_LLM_UNAVAILABLE", "LLM을 쓸 수 없습니다.")
                .withHeader("X-Llm-Calls", header));

        mockMvc.perform(post(runsPath()));

        mockMvc.perform(get(runsPath() + "/current"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("FAILED"))
                .andExpect(jsonPath("$.errorCode").value("AI_LLM_UNAVAILABLE"))
                .andExpect(jsonPath("$.canRetry").value(true));
        mockMvc.perform(get(eventsPath()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ANALYSIS_EVENTS_FAILED"));
        mockMvc.perform(get("/api/analyses/" + analysisId))
                .andExpect(jsonPath("$.status").value("COMPLETED"));
        mockMvc.perform(get("/api/analyses/" + analysisId + "/text-changes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(5)));
        assertThat(llmCallCount("text_event")).isEqualTo(1);
    }

    @Test
    @DisplayName("24시간에 3번 실패하면 canRetry가 false이고 다시 시작은 429다")
    void threeFailuresBlockRetry() throws Exception {
        AI.on(AiServerPaths.TEXT_EVENTS, Reply.error(502, "AI_EVENTS_INVALID_OUTPUT", "쓸 수 있는 사건이 없습니다."));

        for (int i = 0; i < 3; i++) {
            mockMvc.perform(post(runsPath()));
        }

        mockMvc.perform(get(runsPath() + "/current"))
                .andExpect(jsonPath("$.errorCode").value("AI_EVENTS_INVALID_OUTPUT"))
                .andExpect(jsonPath("$.canRetry").value(false));
        mockMvc.perform(post(runsPath()))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("ANALYSIS_EVENTS_RETRY_LIMITED"));
        assertThat(AI.requests(AiServerPaths.TEXT_EVENTS)).hasSize(3);
    }

    @Test
    @DisplayName("ai-server를 부를 수 없으면 AI_SERVER_UNAVAILABLE로 실패하고 다시 시작하면 새 실행으로 완료된다")
    void retryAfterFailureCreatesNewAttempt() throws Exception {
        AI.on(AiServerPaths.TEXT_EVENTS, Reply.error(500, "COMMON_INTERNAL_ERROR", "오류"));
        mockMvc.perform(post(runsPath()));
        mockMvc.perform(get(runsPath() + "/current"))
                .andExpect(jsonPath("$.errorCode").value("AI_SERVER_UNAVAILABLE"));

        AI.on(AiServerPaths.TEXT_EVENTS, Reply.ok(created(EVENT, "3", 0)));
        mockMvc.perform(post(runsPath())).andExpect(status().isAccepted());

        mockMvc.perform(get(runsPath() + "/current")).andExpect(jsonPath("$.status").value("COMPLETED"));
        Integer attempts = jdbcTemplate.queryForObject("SELECT MAX(attempt_no) FROM text_event_run", Integer.class);
        assertThat(attempts).isEqualTo(2);
    }

    @Test
    @DisplayName("근거 ID가 그 변경의 원문 위치가 아니면 저장하지 않고 FAILED로 끝낸다")
    void wrongEvidenceFailsWithoutSaving() throws Exception {
        AI.on(AiServerPaths.TEXT_EVENTS, Reply.ok(created(
                EVENT.replace("\"evidenceId\":\"" + CUR + "#B11\"", "\"evidenceId\":\"" + CUR + "#B99\""), "3", 0)));

        mockMvc.perform(post(runsPath()));

        mockMvc.perform(get(runsPath() + "/current"))
                .andExpect(jsonPath("$.status").value("FAILED"))
                .andExpect(jsonPath("$.errorCode").value("AI_EVENTS_INVALID_OUTPUT"));
        Integer saved = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM text_event", Integer.class);
        assertThat(saved).isZero();
        assertThat(llmCallCount("text_event")).isEqualTo(1);
    }

    @Test
    @DisplayName("규모 근거가 묶인 변경의 위치나 보낸 공시 금액이 아니면 FAILED로 끝낸다")
    void wrongScaleEvidenceFails() throws Exception {
        AI.on(AiServerPaths.TEXT_EVENTS, Reply.ok(created(
                EVENT.replace("\"scaleEvidenceId\":\"" + CUR + "#B11\"", "\"scaleEvidenceId\":\"" + CUR + "#fdpp\""),
                "3", 0)));

        mockMvc.perform(post(runsPath()));

        mockMvc.perform(get(runsPath() + "/current"))
                .andExpect(jsonPath("$.errorCode").value("AI_EVENTS_INVALID_OUTPUT"));
    }

    @Test
    @DisplayName("저장 중 실패하면 앞서 넣은 사건도 남기지 않고 FAILED로 끝내며 호출 기록은 남긴다")
    void saveFailureLeavesNoEvents() throws Exception {
        String tooLong = EVENT.replace("\"sortOrder\":1", "\"sortOrder\":2")
                .replace("소송 패소", "가".repeat(201));
        AI.on(AiServerPaths.TEXT_EVENTS, Reply.ok(created(EVENT + "," + tooLong, "3", 0)));

        mockMvc.perform(post(runsPath()));

        mockMvc.perform(get(runsPath() + "/current"))
                .andExpect(jsonPath("$.status").value("FAILED"))
                .andExpect(jsonPath("$.errorCode").value("ANALYSIS_EVENTS_SAVE_FAILED"));
        Integer saved = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM text_event", Integer.class);
        assertThat(saved).isZero();
        assertThat(llmCallCount("text_event")).isEqualTo(1);
    }

    @Test
    @DisplayName("기간 안 주요사항보고서 금액을 보내고, 그 금액을 규모 근거로 쓴 사건을 받아들인다")
    void structuredAmountIsSentAndAccepted() throws Exception {
        DART.on("/api/list.json", Response.json(DisclosureListJson.page(1, 1,
                DisclosureListJson.item("20260219002746", "주요사항보고서(유상증자결정)", "20260219", ""))),
                Response.json(DisclosureListJson.NO_DATA), Response.json(DisclosureListJson.NO_DATA));
        DART.on("/api/piicDecsn.json", Response.json("""
                {"status":"000","message":"정상","list":[{"rcept_no":"20260219002746","rcept_dt":"20260219",
                "fdpp_ocsa":"2,833,562,221,325"}]}"""));
        AI.on(AiServerPaths.TEXT_EVENTS, Reply.ok(created(
                EVENT.replace("\"scaleEvidenceId\":\"" + CUR + "#B11\"",
                        "\"scaleEvidenceId\":\"20260219002746#fdpp_ocsa\""), "3", 0)));

        mockMvc.perform(post(runsPath()));

        assertThat(AI.requests(AiServerPaths.TEXT_EVENTS).getFirst().bodyText())
                .contains("\"kind\":\"CAPITAL_INCREASE\"", "\"field\":\"fdpp_ocsa\"", "\"amount\":2833562221325");
        mockMvc.perform(get(eventsPath()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].scaleEvidenceId").value("20260219002746#fdpp_ocsa"));
    }

    @Test
    @DisplayName("OpenDART를 부르지 못해도 공시 금액 없이 사건을 만든다")
    void openDartFailureDoesNotFailRun() throws Exception {
        DART.on("/api/list.json", Response.json(DisclosureListJson.RATE_LIMITED));
        AI.on(AiServerPaths.TEXT_EVENTS, Reply.ok(created(EVENT, "3", 0)));

        mockMvc.perform(post(runsPath()));

        mockMvc.perform(get(runsPath() + "/current")).andExpect(jsonPath("$.status").value("COMPLETED"));
        assertThat(AI.requests(AiServerPaths.TEXT_EVENTS).getFirst().bodyText())
                .contains("\"structuredAmounts\":[]");
    }

    private TextEventRun savedRun(int attemptNo) {
        return runRepository.save(TextEventRun.create(analysisId, TextEvents.EVENT_VERSION, attemptNo, "old",
                LocalDateTime.of(2020, 1, 1, 0, 0)));
    }

    @Test
    @DisplayName("진행 중인 실행이 있으면 새로 만들지 않고 202와 그 실행을 돌려주며, 끝나기 전 시각은 null이다")
    void runningRunIsReturnedAsIs() throws Exception {
        TextEventRun run = savedRun(1);
        run.start(NOW);
        runRepository.save(run);

        mockMvc.perform(post(runsPath()))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.status").value("RUNNING"))
                .andExpect(jsonPath("$.startedAt").value(nullValue()))
                .andExpect(jsonPath("$.finishedAt").value(nullValue()));
        mockMvc.perform(get(eventsPath()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ANALYSIS_EVENTS_NOT_READY"));

        assertThat(AI.requests(AiServerPaths.TEXT_EVENTS)).isEmpty();
    }

    @Test
    @DisplayName("서버가 다시 뜨면 이전 실행에서 끝나지 않은 실행을 INTERRUPTED로 바꾸고 다시 시작할 수 있다")
    void restartFailsUnfinishedRuns() throws Exception {
        savedRun(1);

        runner.failInterrupted();

        mockMvc.perform(get(runsPath() + "/current"))
                .andExpect(jsonPath("$.status").value("FAILED"))
                .andExpect(jsonPath("$.errorCode").value("ANALYSIS_EVENTS_INTERRUPTED"))
                .andExpect(jsonPath("$.canRetry").value(true));
    }

    @Test
    @DisplayName("대기열이 가득 차 실패한 실행은 비용이 없어 실패 횟수에 세지 않는다")
    void busyFailuresAreNotCounted() throws Exception {
        for (int attempt = 1; attempt <= 3; attempt++) {
            TextEventRun run = savedRun(attempt);
            run.fail(TextEvents.BUSY, LocalDateTime.now());
            runRepository.save(run);
        }

        mockMvc.perform(get(runsPath() + "/current"))
                .andExpect(jsonPath("$.errorCode").value("ANALYSIS_EVENTS_BUSY"))
                .andExpect(jsonPath("$.canRetry").value(true));
    }

    @Test
    @DisplayName("이 분석의 변경이 아닌 번호를 돌려주면 FAILED로 끝낸다")
    void unknownChangeNoFails() throws Exception {
        AI.on(AiServerPaths.TEXT_EVENTS, Reply.ok(created(EVENT.replace("[1,2]", "[1,99]"), "3", 0)));

        mockMvc.perform(post(runsPath()));

        mockMvc.perform(get(runsPath() + "/current"))
                .andExpect(jsonPath("$.errorCode").value("AI_EVENTS_INVALID_OUTPUT"));
    }

    @Test
    @DisplayName("제공자가 fake면 NOT_CREATED(FAKE_MODEL)로 저장하고 다음 시작 때 새 실행을 만든다")
    void fakeModelIsNotCreatedAndStartsAgain() throws Exception {
        AI.on(AiServerPaths.TEXT_EVENTS, Reply.ok(notCreated("FAKE_MODEL")));

        mockMvc.perform(post(runsPath())).andExpect(status().isAccepted());
        mockMvc.perform(get(runsPath() + "/current"))
                .andExpect(jsonPath("$.status").value("NOT_CREATED"))
                .andExpect(jsonPath("$.notCreatedReason").value("FAKE_MODEL"));
        mockMvc.perform(get(eventsPath()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ANALYSIS_EVENTS_NOT_CREATED"));

        mockMvc.perform(post(runsPath()));

        assertThat(AI.requests(AiServerPaths.TEXT_EVENTS)).hasSize(2);
    }

    @Test
    @DisplayName("후보가 없으면 NOT_CREATED(NO_CANDIDATES)이고 같은 버전이면 다시 부르지 않는다")
    void noCandidatesStaysForSameVersion() throws Exception {
        AI.on(AiServerPaths.TEXT_EVENTS, Reply.ok(notCreated("NO_CANDIDATES")));

        mockMvc.perform(post(runsPath()));
        mockMvc.perform(post(runsPath()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.notCreatedReason").value("NO_CANDIDATES"));

        assertThat(AI.requests(AiServerPaths.TEXT_EVENTS)).hasSize(1);
    }

    @Test
    @DisplayName("문장 비교가 실패한 분석은 실행 없이 NOT_CREATED(TEXT_COMPARE_FAILED)다")
    void failedTextCompareIsNotCreated() throws Exception {
        analysisId = completedAnalysis(TextStatus.FAILED, List.of());

        mockMvc.perform(post(runsPath()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NOT_CREATED"))
                .andExpect(jsonPath("$.notCreatedReason").value("TEXT_COMPARE_FAILED"));

        assertThat(AI.requests(AiServerPaths.TEXT_EVENTS)).isEmpty();
    }

    @Test
    @DisplayName("분류 전 분석은 실행 없이 NOT_CREATED(OLD_ANALYSIS)다")
    void oldAnalysisIsNotCreated() throws Exception {
        analysisId = completedAnalysis(TextStatus.COMPLETED, List.of(new TextChangeRow(TextChangeRow.ADDED, "PARAGRAPH",
                false, "MATCHED", "제목", LAWSUIT_PATH, null, new Side(CUR, 5, 1, "글"), null, null)));

        mockMvc.perform(get(runsPath() + "/current"))
                .andExpect(jsonPath("$.status").value("NOT_CREATED"))
                .andExpect(jsonPath("$.notCreatedReason").value("OLD_ANALYSIS"));
    }

    @Test
    @DisplayName("끝나지 않은 분석은 409 ANALYSIS_NOT_READY, 없는 분석은 404다")
    void analysisMustBeCompleted() throws Exception {
        Analysis running = Analysis.request("00000001", CUR, PREV, ComparisonBasis.YOY, null, NOW);
        Long id = analysisRepository.save(running).getId();

        mockMvc.perform(post("/api/analyses/" + id + "/event-runs"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ANALYSIS_NOT_READY"));
        mockMvc.perform(post("/api/analyses/" + (id + 100) + "/event-runs"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ANALYSIS_NOT_FOUND"));
    }

    @Test
    @DisplayName("파라미터 없는 text-changes 응답은 사건 실행 전후가 같다")
    void textChangesResponseIsUnchanged() throws Exception {
        String before = mockMvc.perform(get("/api/analyses/" + analysisId + "/text-changes"))
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        AI.on(AiServerPaths.TEXT_EVENTS, Reply.ok(created(EVENT, "3", 0)));
        mockMvc.perform(post(runsPath()));

        String after = mockMvc.perform(get("/api/analyses/" + analysisId + "/text-changes"))
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);

        assertThat(after).isEqualTo(before);
    }

    @Test
    @DisplayName("표 변경의 행 수를 보내고, 행을 비교하지 않은 변경은 null로 보낸다")
    void rowCountsAreSentForComparedTables() throws Exception {
        AI.on(AiServerPaths.TEXT_EVENTS, Reply.ok(created(EVENT, "3", 0)));

        mockMvc.perform(post(runsPath()));

        assertThat(AI.requests(AiServerPaths.TEXT_EVENTS).getFirst().bodyText())
                .contains("\"rowCounts\":{\"changed\":3,\"added\":0,\"missing\":0}", "\"rowCounts\":null");
    }

    @Test
    @DisplayName("신호·보류 사유·문장과 문장별 근거·모델·프롬프트 버전·호출 시각을 저장해 그대로 돌려준다")
    void signalAndSentencesAreSavedAndReturned() throws Exception {
        AI.on(AiServerPaths.TEXT_EVENTS, Reply.ok(created(EVENT + "," + HOLD_EVENT, "3", 0)));

        mockMvc.perform(post(runsPath()));

        mockMvc.perform(get(eventsPath()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.signalTableVersion").value("signal-table-2"))
                .andExpect(jsonPath("$.signalCounts[*].signal", contains("CAUTION", "POSITIVE", "HOLD")))
                .andExpect(jsonPath("$.signalCounts[*].eventCount", contains(1, 0, 1)))
                .andExpect(jsonPath("$.items[0].kindCode").value("LITIGATION"))
                .andExpect(jsonPath("$.items[0].changeCode").value("LOST"))
                .andExpect(jsonPath("$.items[0].changeName").value("패소"))
                .andExpect(jsonPath("$.items[0].signal").value("CAUTION"))
                .andExpect(jsonPath("$.items[0].holdReason").value(nullValue()))
                .andExpect(jsonPath("$.items[0].signalEvidenceId").value(CUR + "#B11"))
                .andExpect(jsonPath("$.items[0].rowCounts.changed").value(3))
                .andExpect(jsonPath("$.items[0].meaning.status").value("GENERATED"))
                .andExpect(jsonPath("$.items[0].meaning.aiGenerated").value(true))
                .andExpect(jsonPath("$.items[0].meaning.items[1].type").value("ABSENT"))
                .andExpect(jsonPath("$.items[0].meaning.items[1].absentTopics", contains("AMOUNT")))
                .andExpect(jsonPath("$.items[0].meaning.items[1].evidence[0].evidenceId").value(CUR + "#B12"))
                .andExpect(jsonPath("$.items[0].meaning.items[1].evidence[0].sectionPath").value(LAWSUIT_PATH))
                .andExpect(jsonPath("$.items[0].meaning.model").value("m"))
                .andExpect(jsonPath("$.items[0].meaning.promptVersion").value("event-meaning-1"))
                .andExpect(jsonPath("$.items[0].meaning.generatedAt").value("2026-11-05T10:13:40"))
                .andExpect(jsonPath("$.items[0].signalReason.items[0].type").value("REASON"))
                .andExpect(jsonPath("$.items[0].signalReason.items[0].absentTopics").doesNotExist())
                .andExpect(jsonPath("$.items[0].signalReason.promptVersion").value("event-signal-reason-1"))
                .andExpect(jsonPath("$.items[0].glossary", hasSize(0)))
                .andExpect(jsonPath("$.items[1].signal").value("HOLD"))
                .andExpect(jsonPath("$.items[1].holdReason").value("MIXED_SIDES"))
                .andExpect(jsonPath("$.items[1].rowCounts").value(nullValue()))
                .andExpect(jsonPath("$.items[1].signalReason.status").value("FALLBACK"))
                .andExpect(jsonPath("$.items[1].signalReason.failReason").value("BUDGET_EXCEEDED"))
                .andExpect(jsonPath("$.items[1].signalReason.aiGenerated").value(false))
                .andExpect(jsonPath("$.items[1].signalReason.items[*].text", contains("좋은 면", "나쁜 면")))
                .andExpect(jsonPath("$.items[1].signalReason.items[0].evidence", hasSize(0)))
                .andExpect(jsonPath("$.items[1].signalReason.model").value(nullValue()));
        Integer sentences = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM text_event_sentence", Integer.class);
        assertThat(sentences).isEqualTo(4);
        String version = jdbcTemplate.queryForObject("SELECT signal_table_version FROM text_event_run",
                String.class);
        assertThat(version).isEqualTo("signal-table-2");
    }

    @Test
    @DisplayName("만들지 않은 신호 이유 칸은 null이고 행을 저장하지 않는다")
    void signalReasonNotWrittenIsNull() throws Exception {
        String noCriteria = EVENT.replace("\"signal\":\"CAUTION\",\"holdReason\":null",
                "\"signal\":\"HOLD\",\"holdReason\":\"NO_CRITERIA\"").replace("\"signalReason\":" + REASON,
                "\"signalReason\":null");
        AI.on(AiServerPaths.TEXT_EVENTS, Reply.ok(created(noCriteria, "3", 0)));

        mockMvc.perform(post(runsPath()));

        mockMvc.perform(get(eventsPath()))
                .andExpect(jsonPath("$.items[0].holdReason").value("NO_CRITERIA"))
                .andExpect(jsonPath("$.items[0].signalReason").value(nullValue()))
                .andExpect(jsonPath("$.items[0].meaning.status").value("GENERATED"));
        Integer sentences = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM text_event_sentence", Integer.class);
        assertThat(sentences).isEqualTo(1);
    }

    @Test
    @DisplayName("신호로 거르면 그 신호의 사건만 주고 순서와 개수 칸은 전체로 센다. 정해진 값이 아니면 400이다")
    void signalFilterKeepsOrderAndTotals() throws Exception {
        AI.on(AiServerPaths.TEXT_EVENTS, Reply.ok(created(EVENT + "," + HOLD_EVENT, "3", 0)));
        mockMvc.perform(post(runsPath()));

        mockMvc.perform(get(eventsPath()).param("signal", "HOLD"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].sortOrder").value(2))
                .andExpect(jsonPath("$.signalCounts[0].eventCount").value(1))
                .andExpect(jsonPath("$.fieldCounts[0].eventCount").value(2));
        mockMvc.perform(get(eventsPath()).param("signal", "MIXED"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"))
                .andExpect(jsonPath("$.errors[0].field").value("signal"));
    }

    @Test
    @DisplayName("사실 칸은 같은 분석의 재무상태표에서 공백을 뺀 이름이 같은 계정의 값을 그대로 쓴다")
    void factsUseFinancialChangeOfSameAnalysis() throws Exception {
        AI.on(AiServerPaths.TEXT_EVENTS, Reply.ok(created(EVENT, "3", 0)));
        mockMvc.perform(post(runsPath()));
        Long changeId = jdbcTemplate.queryForObject("SELECT id FROM financial_change WHERE analysis_id = ? "
                + "AND sj_div = 'BS' AND account_name = '충당부채'", Long.class, analysisId);

        mockMvc.perform(get(eventsPath()))
                .andExpect(jsonPath("$.items[0].facts", hasSize(1)))
                .andExpect(jsonPath("$.items[0].facts[0].changeId").value(changeId))
                .andExpect(jsonPath("$.items[0].facts[0].accountType").value(nullValue()))
                .andExpect(jsonPath("$.items[0].facts[0].sjDiv").value("BS"))
                .andExpect(jsonPath("$.items[0].facts[0].accountName").value("충당부채"))
                .andExpect(jsonPath("$.items[0].facts[0].previousAmount").value(1000))
                .andExpect(jsonPath("$.items[0].facts[0].currentAmount").value(1500))
                .andExpect(jsonPath("$.items[0].facts[0].changeAmount").value(500))
                .andExpect(jsonPath("$.items[0].facts[0].changeRate").value(0.5))
                .andExpect(jsonPath("$.items[0].facts[0].calcStatus").value("OK"))
                .andExpect(jsonPath("$.items[0].facts[0].currency").value("KRW"));
    }

    @Test
    @DisplayName("신호 근거가 그 사건의 인용이 아니면 저장하지 않고 FAILED로 끝낸다")
    void wrongSignalEvidenceFails() throws Exception {
        AI.on(AiServerPaths.TEXT_EVENTS, Reply.ok(created(EVENT.replace(
                "\"signalEvidenceId\":\"" + CUR + "#B11\"", "\"signalEvidenceId\":\"" + CUR + "#B12\""), "3", 0)));

        mockMvc.perform(post(runsPath()));

        mockMvc.perform(get(runsPath() + "/current"))
                .andExpect(jsonPath("$.status").value("FAILED"))
                .andExpect(jsonPath("$.errorCode").value("AI_EVENTS_INVALID_OUTPUT"));
        Integer saved = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM text_event", Integer.class);
        assertThat(saved).isZero();
    }

    @Test
    @DisplayName("정해진 값이 아닌 신호, 보류가 아닌데 붙은 보류 사유, 모르는 보류 사유는 FAILED로 끝낸다")
    void unknownSignalValuesFail() throws Exception {
        for (String bad : List.of("\"signal\":\"MIXED\",\"holdReason\":null",
                "\"signal\":\"CAUTION\",\"holdReason\":\"NO_CRITERIA\"",
                "\"signal\":\"HOLD\",\"holdReason\":\"SOMETHING\"")) {
            setUp();
            AI.on(AiServerPaths.TEXT_EVENTS, Reply.ok(created(
                    EVENT.replace("\"signal\":\"CAUTION\",\"holdReason\":null", bad), "3", 0)));

            mockMvc.perform(post(runsPath()));

            mockMvc.perform(get(runsPath() + "/current"))
                    .andExpect(jsonPath("$.errorCode").value("AI_EVENTS_INVALID_OUTPUT"));
        }
    }

    @Test
    @DisplayName("문장 근거가 묶인 변경의 블록이 아니면 그 칸만 실패로 저장한다. 신호 이유는 기준표의 일반 문구다")
    void wrongSentenceEvidenceFailsOnlyThatCell() throws Exception {
        AI.on(AiServerPaths.SIGNAL_TABLES, Reply.ok(TABLE));
        AI.on(AiServerPaths.TEXT_EVENTS, Reply.ok(created(EVENT.replace(
                "\"evidenceIds\":[\"" + CUR + "#B11\"]", "\"evidenceIds\":[\"" + CUR + "#B13\"]"), "3", 0)));

        mockMvc.perform(post(runsPath()));

        mockMvc.perform(get(eventsPath()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].meaning.status").value("FAILED"))
                .andExpect(jsonPath("$.items[0].meaning.failReason").value("INVALID_OUTPUT"))
                .andExpect(jsonPath("$.items[0].meaning.aiGenerated").value(false))
                .andExpect(jsonPath("$.items[0].meaning.items", hasSize(0)))
                .andExpect(jsonPath("$.items[0].meaning.promptVersion").value("event-meaning-1"))
                .andExpect(jsonPath("$.items[0].signalReason.status").value("FALLBACK"))
                .andExpect(jsonPath("$.items[0].signalReason.failReason").value("INVALID_OUTPUT"))
                .andExpect(jsonPath("$.items[0].signalReason.items[0].type").value("GENERAL"))
                .andExpect(jsonPath("$.items[0].signalReason.items[0].text")
                        .value("소송에서 진 것이라, 배상 부담이 생길 수 있어요."));
    }

    @Test
    @DisplayName("옛 사건 버전의 완료된 실행은 보이지 않고 현재 버전으로 새로 만든다")
    void oldEventVersionIsNotShown() throws Exception {
        TextEventRun old = runRepository.save(TextEventRun.create(analysisId, "event-3", 1, "old", NOW));
        old.start(NOW);
        old.complete(0, null, NOW);
        runRepository.save(old);

        mockMvc.perform(get(runsPath() + "/current"))
                .andExpect(jsonPath("$.status").value("NOT_STARTED"));
        AI.on(AiServerPaths.TEXT_EVENTS, Reply.ok(created(EVENT, "3", 0)));
        mockMvc.perform(post(runsPath())).andExpect(status().isAccepted());
        mockMvc.perform(get(eventsPath())).andExpect(jsonPath("$.eventVersion").value("event-4"));
    }

    @Test
    @DisplayName("기준표 조회는 ai-server의 기준표를 그대로 주고, 받지 못하면 메모리에 둔 기준표를 준다")
    void signalTableIsServedFromAiServerOrMemory() throws Exception {
        AI.on(AiServerPaths.SIGNAL_TABLES, Reply.ok(TABLE));

        mockMvc.perform(get("/api/signal-tables/current"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value("signal-table-2"))
                .andExpect(jsonPath("$.signalNotice").value("공시상 신호이며 투자 판단이 아니에요."))
                .andExpect(jsonPath("$.kinds[0].changes[0].general")
                        .value("소송에서 진 것이라, 배상 부담이 생길 수 있어요."))
                .andExpect(jsonPath("$.kinds[1].changes[0].signal").value("MIXED"))
                .andExpect(jsonPath("$.kinds[1].generalSides.good").value("좋은 면"))
                .andExpect(jsonPath("$.glossary", hasSize(0)));

        AI.on(AiServerPaths.SIGNAL_TABLES, Reply.error(500, "COMMON_INTERNAL_ERROR", "오류"));
        mockMvc.perform(get("/api/signal-tables/current"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value("signal-table-2"));
    }
}
