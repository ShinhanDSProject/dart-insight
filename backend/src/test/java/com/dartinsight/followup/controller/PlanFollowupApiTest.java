package com.dartinsight.followup.controller;

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

/**
 * 약속과 실제 대조(1.10, ADR-0041): GET /api/companies/{corpCode}/plan-followups, 가짜 OpenDART(원문)·AI 서버.
 * 작년 계획은 FS-59 전망·계획(POST /internal/outlooks)으로 만든다.
 */
@SpringBootTest
@AutoConfigureMockMvc
class PlanFollowupApiTest {

    static final FakeOpenDartServer DART = startDart();
    static final FakeAiServer AI = new FakeAiServer();
    static final String CORP = "00000001";
    static final String PREV = "20250311000001";
    static final String CUR = "20260310000001";
    static final String OLD = "20240312000001";
    static final String OUTLOOKS = "/internal/outlooks";
    static final String FOLLOWUPS = "/internal/plan-followups";
    static final String PARSER = "/internal/documents/parser";
    static final String DOCUMENT = "/api/document.xml";
    static final String LONG = " 이 문단은 근거로 쓸 수 있을 만큼 원문에 충분히 길게 적었습니다. 마흔 자를 넘습니다.";
    static final String FACILITY = "당사는 평택 신규 라인 증설을 2026년까지 완료할 계획입니다.";
    static final String MARKET = "메모리 시장은 수요 회복으로 성장할 것으로 전망합니다.";
    static final String DIVIDEND = "배당은 매년 1회 지급할 예정입니다.";
    static final String PROGRESS = "평택 신규 라인은 증설 공사를 진행 중입니다.";
    static final String JUDGMENT_FREE = "올해 보고서에 평택 신규 라인 증설 공사를 진행 중이라고 적었어요.";

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
        DART.on(DOCUMENT, Response.zip(TestDocuments.zip(CUR)));
    }

    private void report(String rceptNo, ReportType type, String name, LocalDate periodEnd) {
        reportRepository.save(Report.create(rceptNo, CORP, name,
                new ParsedReportName(type, periodEnd.getYear(), periodEnd, Correction.ORIGINAL),
                periodEnd.plusMonths(2), null, "예시전자", now));
    }

    private void previousReport() {
        report(PREV, ReportType.ANNUAL, "사업보고서 (2024.12)", LocalDate.of(2024, 12, 31));
        AI.on("/internal/documents/" + PREV + "/structure", Reply.ok(previousStructured()));
    }

    private void currentReport() {
        report(CUR, ReportType.ANNUAL, "사업보고서 (2025.12)", LocalDate.of(2025, 12, 31));
        AI.on("/internal/documents/" + CUR + "/structure", Reply.ok(currentStructured()));
    }

    private void bothReports() {
        previousReport();
        currentReport();
        AI.on(OUTLOOKS, Reply.ok(outlookReply("GENERATED", threeOutlookItems())));
    }

    /** 작년: 생산설비(B3 증설 계획)와 경영진단(B5 시장 전망, B6 배당 계획) */
    private static String previousStructured() {
        return """
                {"rceptNo":"%1$s","parserVersion":"dart-xml-1","status":"STRUCTURED","failureCode":null,
                 "failureMessage":null,"mainFile":"%1$s.xml","encoding":"utf-8","attachments":[],"warnings":[],
                 "counts":{"cells":0,"sourceCells":0},
                 "sections":[
                  {"sectionNo":1,"parentNo":null,"level":1,"title":"II. 사업의 내용","cover":false,"blocks":[]},
                  {"sectionNo":3,"parentNo":1,"level":2,"title":"3. 원재료 및 생산설비","cover":false,
                   "blocks":[{"blockNo":3,"type":"PARAGRAPH","text":"%3$s%2$s"}]},
                  {"sectionNo":4,"parentNo":null,"level":1,"title":"IV. 이사의 경영진단 및 분석의견","cover":false,
                   "blocks":[{"blockNo":5,"type":"PARAGRAPH","text":"%4$s%2$s"},
                             {"blockNo":6,"type":"PARAGRAPH","text":"%5$s%2$s"}]}
                 ]}
                """.formatted(PREV, LONG, FACILITY, MARKET, DIVIDEND);
    }

    /** 올해: 생산설비(B11 증설 진행)와 다른 문단들 */
    private static String currentStructured() {
        return """
                {"rceptNo":"%1$s","parserVersion":"dart-xml-1","status":"STRUCTURED","failureCode":null,
                 "failureMessage":null,"mainFile":"%1$s.xml","encoding":"utf-8","attachments":[],"warnings":[],
                 "counts":{"cells":0,"sourceCells":0},
                 "sections":[
                  {"sectionNo":1,"parentNo":null,"level":1,"title":"II. 사업의 내용","cover":false,"blocks":[]},
                  {"sectionNo":3,"parentNo":1,"level":2,"title":"3. 원재료 및 생산설비","cover":false,
                   "blocks":[{"blockNo":11,"type":"PARAGRAPH","text":"%3$s%2$s"},
                             {"blockNo":12,"type":"PARAGRAPH","text":"원재료 매입 현황입니다%2$s"}]},
                  {"sectionNo":4,"parentNo":null,"level":1,"title":"IV. 이사의 경영진단 및 분석의견","cover":false,
                   "blocks":[{"blockNo":13,"type":"PARAGRAPH","text":"지난해 실적을 설명합니다%2$s"},
                             {"blockNo":14,"type":"PARAGRAPH","text":"(1) 개요"}]}
                 ]}
                """.formatted(CUR, LONG, PROGRESS);
    }

    private static String outlookReply(String status, String items) {
        return """
                {"promptVersion":"outlook-1","expressionRulesVersion":"expr-1","model":"fake-model",
                 "generatedAt":"2026-10-27T10:10:00","status":"%s","items":[%s],
                 "reviewReason":"다시 생성해도 인용·근거·숫자 확인을 통과하지 못했어요.","blockedRules":[],
                 "calls":[{"task":"outlook","provider":"fake","model":"fake-model","promptVersion":"outlook-1",
                  "calledAt":"2026-10-27T10:09:59","attempt":1,"latencyMs":5,"outcome":"OK"}]}
                """.formatted(status, items);
    }

    private static String outlookItem(String category, String summary, String quote, int blockNo) {
        return "{\"category\":\"" + category + "\",\"summary\":\"" + summary + "\",\"quote\":\"" + quote
                + "\",\"evidenceIds\":[\"" + PREV + "#B" + blockNo + "\"]}";
    }

    private static String threeOutlookItems() {
        return String.join(",",
                outlookItem("MARKET", "메모리 시장이 성장할 것으로 전망한다고 밝혔어요.", MARKET, 5),
                outlookItem("FINANCIAL", "배당을 매년 1회 지급할 예정이라고 밝혔어요.", DIVIDEND, 6),
                outlookItem("INVESTMENT", "평택 신규 라인 증설을 2026년까지 마칠 계획이라고 밝혔어요.", FACILITY, 3));
    }

    private static String reply(String status, String followups, String reviewReason) {
        return """
                {"promptVersion":"plan-followup-1","expressionRulesVersion":"expr-1","model":"fake-model",
                 "generatedAt":"2026-10-27T10:12:03","status":"%s","followups":[%s],
                 "reviewReason":%s,"blockedRules":%s,
                 "calls":[{"task":"plan_followup","provider":"fake","model":"fake-model",
                  "promptVersion":"plan-followup-1","calledAt":"2026-10-27T10:12:02","traceId":"trace-f1",
                  "inputTokens":900,"outputTokens":120,"latencyMs":800,"attempt":1,"outcome":"OK","error":null}]}
                """.formatted(status, followups, reviewReason == null ? "null" : "\"" + reviewReason + "\"",
                reviewReason == null ? "[]" : "[\"PLAN_JUDGMENT\"]");
    }

    private static String followup(String planId, String status, String summary, String quote, String... ids) {
        String ev = ids.length == 0 ? "" : "\"" + String.join("\",\"", ids) + "\"";
        return "{\"planId\":\"" + planId + "\",\"status\":\"" + status + "\",\"summary\":"
                + (summary == null ? "null" : "\"" + summary + "\"") + ",\"quote\":"
                + (quote == null ? "null" : "\"" + quote + "\"") + ",\"evidenceIds\":[" + ev + "]}";
    }

    private static String mentionedAndNotFound() {
        return String.join(",",
                followup("P1", "MENTIONED", JUDGMENT_FREE, PROGRESS, CUR + "#B11"),
                followup("P2", "NOT_FOUND", null, null));
    }

    private ResultActions followups() throws Exception {
        return mockMvc.perform(get("/api/companies/{corpCode}/plan-followups", CORP));
    }

    private int rows(String table) {
        return jdbcTemplate.queryForObject("SELECT COUNT(*) FROM " + table, Integer.class);
    }

    @Test
    @DisplayName("작년 행동 계획과 올해 관련 문단을 양쪽 근거와 함께 나란히 돌려준다(AC1·AC2)")
    void returnsPlansSideBySideWithBothEvidence() throws Exception {
        bothReports();
        AI.on(FOLLOWUPS, Reply.ok(reply("GENERATED", mentionedAndNotFound(), null)));

        followups()
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.corpCode").value(CORP))
                .andExpect(jsonPath("$.status").value("GENERATED"))
                .andExpect(jsonPath("$.reason").value(nullValue()))
                .andExpect(jsonPath("$.message").value(nullValue()))
                .andExpect(jsonPath("$.previousReport.rceptNo").value(PREV))
                .andExpect(jsonPath("$.previousReport.reportName").value("사업보고서 (2024.12)"))
                .andExpect(jsonPath("$.previousReport.dartUrl").value("https://dart.fss.or.kr/dsaf001/main.do?rcpNo=" + PREV))
                .andExpect(jsonPath("$.currentReport.rceptNo").value(CUR))
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.items[0].planNo").value(1))
                .andExpect(jsonPath("$.items[0].category").value("INVESTMENT"))
                .andExpect(jsonPath("$.items[0].categoryLabel").value("투자·설비"))
                .andExpect(jsonPath("$.items[0].plan.quote").value(FACILITY))
                .andExpect(jsonPath("$.items[0].plan.evidence.evidenceId").value(PREV + "#B3"))
                .andExpect(jsonPath("$.items[0].plan.evidence.rceptNo").value(PREV))
                .andExpect(jsonPath("$.items[0].followup.status").value("MENTIONED"))
                .andExpect(jsonPath("$.items[0].followup.statusLabel").value("관련 언급 있음"))
                .andExpect(jsonPath("$.items[0].followup.summary").value(JUDGMENT_FREE))
                .andExpect(jsonPath("$.items[0].followup.quote").value(PROGRESS))
                .andExpect(jsonPath("$.items[0].followup.evidence.evidenceId").value(CUR + "#B11"))
                .andExpect(jsonPath("$.items[0].followup.evidence.rceptNo").value(CUR))
                .andExpect(jsonPath("$.items[0].followup.evidence.blockNo").value(11))
                .andExpect(jsonPath("$.items[0].followup.evidence.sectionPath").value("II. 사업의 내용 > 3. 원재료 및 생산설비"))
                .andExpect(jsonPath("$.items[1].category").value("FINANCIAL"))
                .andExpect(jsonPath("$.items[1].plan.quote").value(DIVIDEND))
                .andExpect(jsonPath("$.items[1].followup.status").value("NOT_FOUND"))
                .andExpect(jsonPath("$.items[1].followup.statusLabel").value("찾지 못함"))
                .andExpect(jsonPath("$.items[1].followup.summary").value(nullValue()))
                .andExpect(jsonPath("$.items[1].followup.quote").value(nullValue()))
                .andExpect(jsonPath("$.items[1].followup.evidence").value(nullValue()))
                .andExpect(jsonPath("$.aiGenerated").value(true))
                .andExpect(jsonPath("$.ai.model").value("fake-model"))
                .andExpect(jsonPath("$.ai.promptVersion").value("plan-followup-1"))
                .andExpect(jsonPath("$.ai.generatedAt").value("2026-10-27T10:12:03"));

        List<FakeAiServer.Request> requests = AI.requests(FOLLOWUPS);
        assertThat(requests).hasSize(1);
        String body = requests.getFirst().bodyText();
        assertThat(body).contains("\"promptVersion\":\"plan-followup-1\"", "\"companyName\":\"예시전자\"",
                "\"previousReportName\":\"사업보고서 (2024.12)\"", "\"currentReportName\":\"사업보고서 (2025.12)\"",
                "\"planId\":\"P1\",\"category\":\"INVESTMENT\"", "\"planId\":\"P2\",\"category\":\"FINANCIAL\"",
                "\"evidenceId\":\"" + CUR + "#B11\"");
        // 시장·업황 전망은 계획이 아니고, 40자 미만 문단(B14)은 후보가 아니다
        assertThat(body).doesNotContain("MARKET", CUR + "#B14\"", "\"planId\":\"P3\"");
        // P1의 첫 후보는 증설 진행 문단이다
        assertThat(body.indexOf(CUR + "#B11")).isLessThan(body.indexOf("\"planId\":\"P2\""));
        assertThat(requests.getFirst().traceId()).isNotBlank();

        Map<String, Object> call = jdbcTemplate.queryForMap(
                "SELECT analysis_id, company_outlook_id, plan_followup_id, task FROM llm_call WHERE task = 'plan_followup'");
        assertThat(call.get("analysis_id")).isNull();
        assertThat(call.get("company_outlook_id")).isNull();
        assertThat(call.get("plan_followup_id")).isNotNull();
        assertThat(rows("company_outlook")).isEqualTo(1);
    }

    @Test
    @DisplayName("같은 두 보고서·프롬프트 버전이면 저장한 대조를 돌려주고 AI를 다시 부르지 않는다(AC6)")
    void savedFollowupIsReused() throws Exception {
        bothReports();
        AI.on(FOLLOWUPS, Reply.ok(reply("GENERATED", mentionedAndNotFound(), null)));

        followups().andExpect(status().isOk()).andExpect(jsonPath("$.status").value("GENERATED"));
        AI.on(FOLLOWUPS, Reply.error(503, "AI_LLM_UNAVAILABLE", "LLM 없음"));
        AI.on(OUTLOOKS, Reply.error(503, "AI_LLM_UNAVAILABLE", "LLM 없음"));
        followups()
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("GENERATED"))
                .andExpect(jsonPath("$.items[0].followup.quote").value(PROGRESS))
                .andExpect(jsonPath("$.items[1].followup.evidence").value(nullValue()));

        assertThat(AI.requests(FOLLOWUPS)).hasSize(1);
        assertThat(AI.requests(OUTLOOKS)).hasSize(1);
        assertThat(rows("plan_followup")).isEqualTo(1);
    }

    @Test
    @DisplayName("작년 전망·계획이 이미 저장돼 있으면 그것을 쓰고 전망을 다시 만들지 않는다")
    void storedPreviousOutlookIsReused() throws Exception {
        bothReports();
        outlookService.forReport(PREV);
        assertThat(AI.requests(OUTLOOKS)).hasSize(1);

        AI.on(FOLLOWUPS, Reply.ok(reply("GENERATED", mentionedAndNotFound(), null)));
        followups().andExpect(status().isOk()).andExpect(jsonPath("$.status").value("GENERATED"));

        assertThat(AI.requests(OUTLOOKS)).hasSize(1);
        assertThat(rows("company_outlook")).isEqualTo(1);
    }

    @Test
    @DisplayName("사업보고서가 하나뿐이면 NOT_AVAILABLE(NO_PREVIOUS_REPORT)이고 AI를 부르지 않는다(AC4)")
    void onlyOneAnnualReportIsNotAvailable() throws Exception {
        currentReport();
        report("20260814000001", ReportType.HALF, "반기보고서 (2026.06)", LocalDate.of(2026, 6, 30));

        followups()
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NOT_AVAILABLE"))
                .andExpect(jsonPath("$.reason").value("NO_PREVIOUS_REPORT"))
                .andExpect(jsonPath("$.message").value("사업연도가 한 해 앞선 사업보고서가 없어 작년 계획과 나란히 볼 수 없어요."))
                .andExpect(jsonPath("$.previousReport").value(nullValue()))
                .andExpect(jsonPath("$.currentReport.rceptNo").value(CUR))
                .andExpect(jsonPath("$.items", hasSize(0)))
                .andExpect(jsonPath("$.aiGenerated").value(false))
                .andExpect(jsonPath("$.ai").value(nullValue()));
        assertThat(AI.requests(OUTLOOKS)).isEmpty();
        assertThat(AI.requests(FOLLOWUPS)).isEmpty();
    }

    @Test
    @DisplayName("사업연도가 한 해 앞선 보고서가 아니면(2년 전) 이전 보고서로 쓰지 않는다")
    void reportTwoYearsBeforeIsNotPrevious() throws Exception {
        currentReport();
        report(OLD, ReportType.ANNUAL, "사업보고서 (2023.12)", LocalDate.of(2023, 12, 31));

        followups()
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NOT_AVAILABLE"))
                .andExpect(jsonPath("$.reason").value("NO_PREVIOUS_REPORT"));
    }

    @Test
    @DisplayName("사업보고서가 없으면 NOT_AVAILABLE(NO_REPORT)")
    void noAnnualReportIsNotAvailable() throws Exception {
        report("20260814000001", ReportType.HALF, "반기보고서 (2026.06)", LocalDate.of(2026, 6, 30));

        followups()
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NOT_AVAILABLE"))
                .andExpect(jsonPath("$.reason").value("NO_REPORT"))
                .andExpect(jsonPath("$.previousReport").value(nullValue()))
                .andExpect(jsonPath("$.currentReport").value(nullValue()));
    }

    @Test
    @DisplayName("작년 전망·계획에 시장 전망만 있으면 EMPTY(NO_PREVIOUS_PLAN)이고 대조하지 않으며 저장하지 않는다(AC5)")
    void onlyMarketOutlookIsEmptyWithoutAiCall() throws Exception {
        previousReport();
        currentReport();
        AI.on(OUTLOOKS, Reply.ok(outlookReply("GENERATED",
                outlookItem("MARKET", "메모리 시장이 성장할 것으로 전망한다고 밝혔어요.", MARKET, 5))));

        followups()
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("EMPTY"))
                .andExpect(jsonPath("$.reason").value("NO_PREVIOUS_PLAN"))
                .andExpect(jsonPath("$.message").value("작년 사업보고서에서 회사가 밝힌 투자·사업·재무 계획을 찾지 못했어요."))
                .andExpect(jsonPath("$.previousReport.rceptNo").value(PREV))
                .andExpect(jsonPath("$.aiGenerated").value(false));
        assertThat(AI.requests(FOLLOWUPS)).isEmpty();
        assertThat(rows("plan_followup")).isZero();
    }

    @Test
    @DisplayName("작년 전망·계획이 검토 필요면 REVIEW_NEEDED(PREVIOUS_REVIEW_NEEDED)이고 대조하지 않는다")
    void previousOutlookReviewNeededStopsWithoutAiCall() throws Exception {
        previousReport();
        currentReport();
        AI.on(OUTLOOKS, Reply.ok(outlookReply("REVIEW_NEEDED", "")));

        followups()
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REVIEW_NEEDED"))
                .andExpect(jsonPath("$.reason").value("PREVIOUS_REVIEW_NEEDED"))
                .andExpect(jsonPath("$.items", hasSize(0)))
                .andExpect(jsonPath("$.aiGenerated").value(false));
        assertThat(AI.requests(FOLLOWUPS)).isEmpty();
        assertThat(rows("plan_followup")).isZero();
    }

    @Test
    @DisplayName("근거 없는 MENTIONED는 항목 없이 검토 필요로 저장한다(AC3)")
    void mentionedWithoutEvidenceIsReviewNeeded() throws Exception {
        bothReports();
        AI.on(FOLLOWUPS, Reply.ok(reply("GENERATED", String.join(",",
                followup("P1", "MENTIONED", JUDGMENT_FREE, PROGRESS),
                followup("P2", "NOT_FOUND", null, null)), null)));

        followups()
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REVIEW_NEEDED"))
                .andExpect(jsonPath("$.reason").value(nullValue()))
                .andExpect(jsonPath("$.message").value("대조 결과의 인용이나 근거가 보낸 원문과 맞지 않아 쓰지 않았어요."))
                .andExpect(jsonPath("$.items", hasSize(0)))
                .andExpect(jsonPath("$.aiGenerated").value(true));
        assertThat(rows("plan_followup")).isEqualTo(1);
    }

    @Test
    @DisplayName("후보 밖 근거(보내지 않은 블록)를 쓴 MENTIONED는 검토 필요다(AC3)")
    void evidenceOutsideCandidatesIsReviewNeeded() throws Exception {
        bothReports();
        AI.on(FOLLOWUPS, Reply.ok(reply("GENERATED", String.join(",",
                followup("P1", "MENTIONED", JUDGMENT_FREE, "(1) 개요", CUR + "#B14"),
                followup("P2", "NOT_FOUND", null, null)), null)));

        followups()
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REVIEW_NEEDED"))
                .andExpect(jsonPath("$.items", hasSize(0)));
    }

    @Test
    @DisplayName("NOT_FOUND에 근거가 붙어 있거나 계획 하나가 빠지면 검토 필요다")
    void notFoundWithEvidenceOrMissingPlanIsReviewNeeded() throws Exception {
        bothReports();
        AI.on(FOLLOWUPS, Reply.ok(reply("GENERATED", String.join(",",
                followup("P1", "NOT_FOUND", null, null, CUR + "#B11"),
                followup("P2", "NOT_FOUND", null, null)), null)));

        followups().andExpect(status().isOk()).andExpect(jsonPath("$.status").value("REVIEW_NEEDED"));

        TestData.clearAll(jdbcTemplate);
        setUp();
        bothReports();
        AI.on(FOLLOWUPS, Reply.ok(reply("GENERATED", followup("P2", "NOT_FOUND", null, null), null)));

        followups().andExpect(status().isOk()).andExpect(jsonPath("$.status").value("REVIEW_NEEDED"));
    }

    @Test
    @DisplayName("AI 서버가 재생성 뒤에도 실패해 검토 필요로 답하면 사유와 함께 저장하고 다시 만들지 않는다(AC3·AC7)")
    void reviewNeededFromAiServerIsSavedAndNotGeneratedAgain() throws Exception {
        bothReports();
        AI.on(FOLLOWUPS, Reply.ok(reply("REVIEW_NEEDED", "", "계획을 평가하는 표현이 있어 대조 결과를 내보내지 않았어요.")));

        for (int i = 0; i < 2; i++) {
            followups()
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("REVIEW_NEEDED"))
                    .andExpect(jsonPath("$.message").value("계획을 평가하는 표현이 있어 대조 결과를 내보내지 않았어요."))
                    .andExpect(jsonPath("$.items", hasSize(0)));
        }
        assertThat(AI.requests(FOLLOWUPS)).hasSize(1);
        assertThat(jdbcTemplate.queryForObject("SELECT blocked_rules FROM plan_followup", String.class))
                .isEqualTo("PLAN_JUDGMENT");
    }

    @Test
    @DisplayName("AI 서버를 쓸 수 없으면 503이고 저장하지 않아 다음 요청에서 다시 만든다")
    void aiServerFailureIsNotSaved() throws Exception {
        bothReports();
        AI.on(FOLLOWUPS, Reply.error(503, "AI_LLM_UNAVAILABLE", "LLM 없음"));

        followups()
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("AI_SERVER_UNAVAILABLE"));
        assertThat(rows("plan_followup")).isZero();

        AI.on(FOLLOWUPS, Reply.ok(reply("GENERATED", mentionedAndNotFound(), null)));
        followups().andExpect(status().isOk()).andExpect(jsonPath("$.status").value("GENERATED"));
        assertThat(AI.requests(FOLLOWUPS)).hasSize(2);
    }

    @Test
    @DisplayName("없는 기업은 404 COMPANY_NOT_FOUND")
    void unknownCompanyIsNotFound() throws Exception {
        mockMvc.perform(get("/api/companies/{corpCode}/plan-followups", "99999999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COMPANY_NOT_FOUND"));
    }
}
