package com.dartinsight.explanation.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.dartinsight.aiserver.client.FakeAiServer;
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
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/**
 * 문장 변경 AI 한 줄 풀이(3.11) API 테스트의 공통 자료: 완료된 분석 하나와 세 변경, 가짜 AI 서버.
 * 하위 클래스가 @SpringBootTest를 단다(한도 테스트는 한도를 켠 설정으로).
 */
@AutoConfigureMockMvc
abstract class ExplanationApiFixture {

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
    protected MockMvc mockMvc;

    @Autowired
    protected AnalysisRepository analysisRepository;

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
    protected JdbcTemplate jdbcTemplate;

    protected Long analysisId;

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

    protected Long changeId(int changeNo) {
        return jdbcTemplate.queryForObject("SELECT id FROM text_change WHERE analysis_id = ? AND change_no = ?",
                Long.class, analysisId, changeNo);
    }

    protected ResultActions explain(Long id, Long changeId) throws Exception {
        return mockMvc.perform(post("/api/analyses/{a}/text-changes/{c}/explanations", id, changeId));
    }

    /** 프록시를 거쳐 온 비로그인 요청처럼 클라이언트 IP를 붙인다(하루 한도는 이 IP로 셈) */
    protected ResultActions explainFrom(String clientIp, Long id, Long changeId) throws Exception {
        return mockMvc.perform(post("/api/analyses/{a}/text-changes/{c}/explanations", id, changeId)
                .header("X-Forwarded-For", clientIp));
    }

    protected int explanationRows() {
        return jdbcTemplate.queryForObject("SELECT COUNT(*) FROM text_change_explanation", Integer.class);
    }

    protected static String summaryReply(String item) {
        return """
                {"promptVersion":"summary-2","model":"fake-model","generatedAt":"2026-10-25T09:40:11","items":[%s],
                 "calls":[{"task":"summary","provider":"fake","model":"fake-model","promptVersion":"summary-2",
                  "calledAt":"2026-10-25T09:40:10","traceId":"trace-x1","inputTokens":300,"outputTokens":40,
                  "latencyMs":500,"attempt":1,"outcome":"OK","error":null}]}
                """.formatted(item);
    }
}
