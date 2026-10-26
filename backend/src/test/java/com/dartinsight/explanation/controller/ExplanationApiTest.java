package com.dartinsight.explanation.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dartinsight.aiserver.client.FakeAiServer;
import com.dartinsight.aiserver.client.FakeAiServer.Reply;
import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.domain.TextChangeRow;
import com.dartinsight.analysis.domain.TextChangeRow.Side;
import com.dartinsight.analysis.domain.TextComparison;
import com.dartinsight.analysis.domain.TextStatus;
import com.dartinsight.analysis.repository.AnalysisRepository;
import com.dartinsight.analysis.service.AnalysisResultService;
import com.dartinsight.company.service.CompanyImportService;
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
import com.dartinsight.summary.domain.SummaryItemRow;
import com.dartinsight.summary.domain.SummaryResult;
import com.dartinsight.summary.domain.SummaryStatus;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/** 문장 변경 AI 한 줄 풀이(3.11): POST /api/analyses/{analysisId}/text-changes/{changeId}/explanations */
@SpringBootTest
@AutoConfigureMockMvc
class ExplanationApiTest {

    static final FakeAiServer AI = new FakeAiServer();
    static final String SUMMARIES = "/internal/summaries";
    static final String CUR = "20260814000001";
    static final String PREV = "20250814000001";
    static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 25, 9, 0);

    /** change_no 1: 수정(두 보고서 B3), 2: 추가(현재 B2, 요약에 있음), 3: 검토 필요(섹션 단위, 원문 없음) */
    static final int MODIFIED = 1;
    static final int SUMMARIZED = 2;
    static final int UNMATCHED = 3;

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
    private CompanyImportService companyImportService;

    @Autowired
    private ReportRepository reportRepository;

    @Autowired
    private ReportDocumentRepository documentRepository;

    @Autowired
    private DocumentStore documentStore;

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
        // 비교 보고서 원문만 구조화돼 있다(섹션 이름이 바뀜). 현재 보고서 근거의 경로는 변경의 섹션 경로로 대신한다
        previousDocument();
        Analysis analysis = Analysis.request("00000001", CUR, PREV, ComparisonBasis.YOY, null, NOW);
        analysis.start(NOW);
        analysis.recordFsDiv(FsDiv.CFS);
        analysisId = analysisRepository.save(analysis).getId();

        String path = "II. 사업의 내용 > 7. 기타 참고사항";
        List<TextChangeRow> rows = List.of(
                new TextChangeRow(TextChangeRow.MODIFIED, "PARAGRAPH", false, "MATCHED", "7. 기타 참고사항", path,
                        new Side(PREV, 3, 3, "종속회사는 소송 중입니다."),
                        new Side(CUR, 3, 3, "종속회사는 과징금을 납부했습니다."), new BigDecimal("0.5"), null),
                new TextChangeRow(TextChangeRow.ADDED, "PARAGRAPH", false, "MATCHED", "7. 기타 참고사항", path,
                        null, new Side(CUR, 3, 2, "새 공장을 지었습니다."), null, null),
                new TextChangeRow(TextChangeRow.REVIEW_NEEDED, TextChangeRow.SECTION, false, "AMBIGUOUS",
                        "8. 그 밖의 사항", "II. 사업의 내용 > 8. 그 밖의 사항", new Side(PREV, 4, null, null),
                        new Side(CUR, 4, null, null), null, "섹션 짝을 정하지 못했어요."));
        SummaryResult summary = new SummaryResult(SummaryStatus.COMPLETED, null, List.of(
                new SummaryItemRow(SummaryItemRow.TEXT, SummaryItemRow.SHOWN, null, "현재 보고서에 새 공장 소식이 적혔어요.",
                        null, List.of(CUR + "#B2"), null, SUMMARIZED, null, "summary-model", "summary-2",
                        LocalDateTime.of(2026, 10, 24, 8, 0, 0), List.of())), List.of());
        resultService.saveAndComplete(analysisId, List.of(),
                new TextComparison(TextStatus.COMPLETED, null, rows), summary);
    }

    private void previousDocument() {
        List<Section> sections = List.of(
                new Section(2, null, 1, "II. 사업의 내용", null, false, List.of()),
                new Section(3, 2, 2, "7. 기타 사항", null, false, List.of(
                        new Block(3, "PARAGRAPH", "종속회사는 소송 중입니다.", null))));
        StructuredDocumentResponse response = new StructuredDocumentResponse(PREV, "dart-xml-1", "STRUCTURED",
                null, null, PREV + ".xml", "utf-8", "반기보고서", "예시전자", List.of(), List.of(),
                Map.of("cells", 0, "sourceCells", 0), sections);
        ReportDocument saved = documentRepository.save(ReportDocument.structured(PREV, response, 100, NOW, NOW));
        documentStore.replace(saved.getId(), sections);
    }

    private Long changeId(int changeNo) {
        return jdbcTemplate.queryForObject("SELECT id FROM text_change WHERE analysis_id = ? AND change_no = ?",
                Long.class, analysisId, changeNo);
    }

    private ResultActions explain(Long id, Long changeId) throws Exception {
        return mockMvc.perform(post("/api/analyses/{a}/text-changes/{c}/explanations", id, changeId));
    }

    private int explanationRows() {
        return jdbcTemplate.queryForObject("SELECT COUNT(*) FROM text_change_explanation", Integer.class);
    }

    private static String summaryReply(String item) {
        return """
                {"promptVersion":"summary-2","model":"fake-model","generatedAt":"2026-10-25T09:40:11","items":[%s],
                 "calls":[{"task":"summary","provider":"fake","model":"fake-model","promptVersion":"summary-2",
                  "calledAt":"2026-10-25T09:40:10","traceId":"trace-x1","inputTokens":300,"outputTokens":40,
                  "latencyMs":500,"attempt":1,"outcome":"OK","error":null}]}
                """.formatted(item);
    }

    @Test
    @DisplayName("처음엔 AI 서버로 만들어 저장하고, 두 번째는 AI 서버를 부르지 않고 cached true")
    void generatesOnceThenReturnsCached() throws Exception {
        AI.on(SUMMARIES, request -> {
            String ref = JsonPath.<String>read(request.bodyText(), "$.textItems[0].ref");
            return Reply.ok(summaryReply("""
                    {"ref":"%s","kind":"TEXT","status":"OK","sentence":"현재 보고서에 종속회사의 과징금 납부 사실이 적혔어요.",
                     "evidenceIds":["%s#B3","%s#B3"],"reviewReason":null,"blockedRules":[]}""".formatted(ref, CUR,
                    PREV)));
        });
        Long changeId = changeId(MODIFIED);

        explain(analysisId, changeId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.changeId").value(changeId))
                .andExpect(jsonPath("$.status").value("OK"))
                .andExpect(jsonPath("$.sentence").value("현재 보고서에 종속회사의 과징금 납부 사실이 적혔어요."))
                .andExpect(jsonPath("$.message").doesNotExist())
                .andExpect(jsonPath("$.evidence", hasSize(2)))
                .andExpect(jsonPath("$.evidence[0].side").value("current"))
                .andExpect(jsonPath("$.evidence[0].rceptNo").value(CUR))
                .andExpect(jsonPath("$.evidence[0].sectionNo").value(3))
                .andExpect(jsonPath("$.evidence[0].blockNo").value(3))
                .andExpect(jsonPath("$.evidence[0].sectionPath").value("II. 사업의 내용 > 7. 기타 참고사항"))
                .andExpect(jsonPath("$.evidence[0].evidenceId").value(CUR + "#B3"))
                .andExpect(jsonPath("$.evidence[1].side").value("previous"))
                .andExpect(jsonPath("$.evidence[1].rceptNo").value(PREV))
                .andExpect(jsonPath("$.evidence[1].sectionNo").value(3))
                .andExpect(jsonPath("$.evidence[1].blockNo").value(3))
                .andExpect(jsonPath("$.evidence[1].sectionPath").value("II. 사업의 내용 > 7. 기타 사항"))
                .andExpect(jsonPath("$.evidence[1].evidenceId").value(PREV + "#B3"))
                .andExpect(jsonPath("$.aiGenerated").value(true))
                .andExpect(jsonPath("$.ai.model").value("fake-model"))
                .andExpect(jsonPath("$.ai.promptVersion").value("summary-2"))
                .andExpect(jsonPath("$.ai.generatedAt").value("2026-10-25T09:40:11"))
                .andExpect(jsonPath("$.cached").value(false));

        // 보낸 것: 문장 항목 하나(두 보고서 원문), 재무 항목은 빈 목록
        String sent = AI.requests(SUMMARIES).getFirst().bodyText();
        assertThat(JsonPath.<String>read(sent, "$.companyName")).isEqualTo("예시전자");
        assertThat(JsonPath.<List<Object>>read(sent, "$.textItems")).hasSize(1);
        assertThat(JsonPath.<List<Object>>read(sent, "$.financialItems")).isEmpty();
        assertThat(JsonPath.<List<String>>read(sent, "$.textItems[0].sources[*].evidenceId"))
                .containsExactly(PREV + "#B3", CUR + "#B3");

        explain(analysisId, changeId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OK"))
                .andExpect(jsonPath("$.sentence").value("현재 보고서에 종속회사의 과징금 납부 사실이 적혔어요."))
                .andExpect(jsonPath("$.evidence[0].evidenceId").value(CUR + "#B3"))
                .andExpect(jsonPath("$.evidence[1].sectionPath").value("II. 사업의 내용 > 7. 기타 사항"))
                .andExpect(jsonPath("$.ai.generatedAt").value("2026-10-25T09:40:11"))
                .andExpect(jsonPath("$.cached").value(true));
        assertThat(AI.requests(SUMMARIES)).hasSize(1);

        Map<String, Object> stored = jdbcTemplate.queryForMap("SELECT * FROM text_change_explanation");
        assertThat(stored.get("change_no")).isEqualTo(MODIFIED);
        assertThat(stored.get("status")).isEqualTo("OK");
        assertThat(stored.get("evidence_ids")).isEqualTo(CUR + "#B3," + PREV + "#B3");
        assertThat(stored.get("model")).isEqualTo("fake-model");
        assertThat(stored.get("trace_id")).isNotNull();
        Map<String, Object> call = jdbcTemplate.queryForMap("SELECT * FROM llm_call");
        assertThat(call.get("analysis_id")).isEqualTo(analysisId);
        assertThat(call.get("trace_id")).isEqualTo("trace-x1");
    }

    @Test
    @DisplayName("요약에 그 변경의 AI 문장이 있으면 AI 서버 없이 그 문장을 저장해 돌려준다")
    void reusesSummarySentenceWithoutAiServer() throws Exception {
        explain(analysisId, changeId(SUMMARIZED))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OK"))
                .andExpect(jsonPath("$.sentence").value("현재 보고서에 새 공장 소식이 적혔어요."))
                .andExpect(jsonPath("$.evidence[0].evidenceId").value(CUR + "#B2"))
                .andExpect(jsonPath("$.evidence[0].sectionNo").value(3))
                .andExpect(jsonPath("$.evidence[0].blockNo").value(2))
                .andExpect(jsonPath("$.evidence[0].sectionPath").value("II. 사업의 내용 > 7. 기타 참고사항"))
                .andExpect(jsonPath("$.ai.model").value("summary-model"))
                .andExpect(jsonPath("$.ai.promptVersion").value("summary-2"))
                .andExpect(jsonPath("$.ai.generatedAt").value("2026-10-24T08:00:00"))
                .andExpect(jsonPath("$.cached").value(false));
        assertThat(AI.requests(SUMMARIES)).isEmpty();
        assertThat(explanationRows()).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM llm_call", Integer.class)).isZero();
    }

    @Test
    @DisplayName("짝을 찾지 못해 원문이 없는 변경은 AI 서버 없이 NO_SOURCE로 저장한다")
    void unmatchedChangeHasNoSourceWithoutAiServer() throws Exception {
        Long changeId = changeId(UNMATCHED);
        explain(analysisId, changeId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NO_SOURCE"))
                .andExpect(jsonPath("$.sentence").doesNotExist())
                .andExpect(jsonPath("$.message").value("두 보고서에서 이 변경의 원문을 짝짓지 못해 풀이할 수 없어요."))
                .andExpect(jsonPath("$.evidence", hasSize(0)))
                .andExpect(jsonPath("$.aiGenerated").value(false))
                .andExpect(jsonPath("$.ai").doesNotExist())
                .andExpect(jsonPath("$.cached").value(false));
        explain(analysisId, changeId)
                .andExpect(jsonPath("$.status").value("NO_SOURCE"))
                .andExpect(jsonPath("$.cached").value(true));
        assertThat(AI.requests(SUMMARIES)).isEmpty();
        assertThat(explanationRows()).isEqualTo(1);
    }

    @Test
    @DisplayName("보내지 않은 원문을 근거로 든 풀이는 쓰지 않고 REVIEW_NEEDED, AI 서버의 검토 필요는 사유와 규칙을 남긴다")
    void failedValidationNeedsReview() throws Exception {
        AI.on(SUMMARIES, request -> {
            String ref = JsonPath.<String>read(request.bodyText(), "$.textItems[0].ref");
            return Reply.ok(summaryReply("""
                    {"ref":"%s","kind":"TEXT","status":"OK","sentence":"다른 보고서 내용",
                     "evidenceIds":["%s#B99"],"reviewReason":null,"blockedRules":[]}""".formatted(ref, CUR)));
        });
        explain(analysisId, changeId(MODIFIED))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REVIEW_NEEDED"))
                .andExpect(jsonPath("$.sentence").doesNotExist())
                .andExpect(jsonPath("$.message").value("요약 문장의 근거가 보낸 원문 위치가 아니라 쓰지 않았어요."))
                .andExpect(jsonPath("$.evidence", hasSize(0)))
                .andExpect(jsonPath("$.ai").doesNotExist())
                .andExpect(jsonPath("$.cached").value(false));

        setUp();
        AI.on(SUMMARIES, request -> {
            String ref = JsonPath.<String>read(request.bodyText(), "$.textItems[0].ref");
            return Reply.ok(summaryReply("""
                    {"ref":"%s","kind":"TEXT","status":"REVIEW_NEEDED","sentence":null,"evidenceIds":[],
                     "reviewReason":"투자 권유로 읽힐 수 있는 표현이 있어요.","blockedRules":["EXPR-BUY"]}"""
                    .formatted(ref)));
        });
        explain(analysisId, changeId(MODIFIED))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REVIEW_NEEDED"))
                .andExpect(jsonPath("$.message").value("투자 권유로 읽힐 수 있는 표현이 있어요."));
        Map<String, Object> stored = jdbcTemplate.queryForMap("SELECT * FROM text_change_explanation");
        assertThat(stored.get("status")).isEqualTo("REVIEW_NEEDED");
        assertThat(stored.get("blocked_rules")).isEqualTo("EXPR-BUY");
        assertThat(stored.get("sentence")).isNull();
    }

    @Test
    @DisplayName("없는 분석·이 분석의 변경이 아니면 404, 끝나지 않은 분석은 409")
    void unknownIsNotFoundAndUnfinishedIsNotReady() throws Exception {
        explain(999_999L, changeId(MODIFIED))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ANALYSIS_NOT_FOUND"));
        explain(analysisId, 999_999L)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ANALYSIS_TEXT_CHANGE_NOT_FOUND"));

        Long running = analysisRepository.save(
                Analysis.request("00000001", CUR, PREV, ComparisonBasis.PREV, null, NOW)).getId();
        explain(running, changeId(MODIFIED))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ANALYSIS_NOT_READY"));
        assertThat(AI.requests(SUMMARIES)).isEmpty();
        assertThat(explanationRows()).isZero();
    }

    @Test
    @DisplayName("AI 서버나 LLM을 쓸 수 없으면 503 AI_SERVER_UNAVAILABLE이고 저장하지 않는다")
    void aiServerFailureIsServiceUnavailable() throws Exception {
        AI.on(SUMMARIES, Reply.error(503, "AI_LLM_UNAVAILABLE", "LLM을 쓸 수 없어요."));

        explain(analysisId, changeId(MODIFIED))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("AI_SERVER_UNAVAILABLE"));
        assertThat(explanationRows()).isZero();
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM llm_call", Integer.class)).isZero();
    }
}
