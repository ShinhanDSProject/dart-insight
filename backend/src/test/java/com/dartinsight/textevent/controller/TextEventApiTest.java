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
import com.dartinsight.analysis.domain.TextChangeListing;
import com.dartinsight.analysis.domain.TextChangeListing.RowDiff;
import com.dartinsight.analysis.domain.TextChangeRow;
import com.dartinsight.analysis.domain.TextChangeRow.Side;
import com.dartinsight.analysis.domain.TextComparison;
import com.dartinsight.analysis.domain.TextStatus;
import com.dartinsight.analysis.repository.AnalysisRepository;
import com.dartinsight.analysis.service.AnalysisResultService;
import com.dartinsight.company.service.CompanyImportService;
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
            {"task":"text_event","provider":"openai","model":"m","promptVersion":"text-event-1",
             "calledAt":"2026-11-05T10:13:01","traceId":"evt-1","inputTokens":10,"outputTokens":5,
             "latencyMs":100,"attempt":1,"outcome":"OK","error":null}""";
    private static final String EVENT = """
            {"sortOrder":1,"title":"소송 패소","kind":"소송","changeNos":[1,2],
             "quotes":[{"changeNo":1,"purpose":"CHANGE","side":"CURRENT","text":"패소","evidenceId":"%s#B11"}],
             "scaleAmount":12000000000,"scaleAmountText":"120억원","currency":"KRW",
             "scaleAmountKrw":12000000000,"scaleRatio":0.012,"scaleNotComputedReason":null,
             "scaleEvidenceId":"%s#B11","amountSource":"single_candidate","fxSource":null,"fxRateDate":null,
             "sortBasis":"AMOUNT"}""".formatted(CUR, CUR);

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
        resultService.saveAndComplete(id, List.of(), new TextComparison(textStatus, null, rows));
        return id;
    }

    private static TextChangeRow change(String field, String group, String blockType, int blockNo, RowDiff rowDiff) {
        return new TextChangeRow(TextChangeRow.MODIFIED, blockType, false, "MATCHED", "제목", LAWSUIT_PATH,
                new Side(PREV, 5, blockNo + 100, "이전 글 " + blockNo), new Side(CUR, 5, blockNo, "패소 글 " + blockNo),
                null, null, null, null,
                new TextChangeListing(group, field, false, null, rowDiff, "list-1"));
    }

    private static String created(String events, String unbound, int dropped) {
        return """
                {"created":true,"notCreatedReason":null,"model":"m","promptVersion":"text-event-1",
                 "generatedAt":"2026-11-05T10:13:02","droppedEventCount":%d,"events":[%s],
                 "unboundChangeNos":[%s],"calls":[%s]}""".formatted(dropped, events, unbound, CALL);
    }

    private static String notCreated(String reason) {
        return """
                {"created":false,"notCreatedReason":"%s","model":null,"promptVersion":"text-event-1",
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
                .andExpect(jsonPath("$.eventVersion").value("event-2"));

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
                .andExpect(jsonPath("$.items[0].amountSource").value("single_candidate"))
                .andExpect(jsonPath("$.items[0].sortBasis").value("AMOUNT"))
                .andExpect(jsonPath("$.items[0].aiGenerated").value(true))
                .andExpect(jsonPath("$.items[0].model").value("m"))
                .andExpect(jsonPath("$.items[0].promptVersion").value("text-event-1"))
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
}
