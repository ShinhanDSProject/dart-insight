package com.dartinsight.analysis.service;

import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.domain.TextChangeFilter;
import com.dartinsight.analysis.domain.TextChangeRow;
import com.dartinsight.analysis.domain.TextChangeRow.Side;
import com.dartinsight.analysis.domain.TextComparison;
import com.dartinsight.analysis.domain.TextStatus;
import com.dartinsight.analysis.repository.AnalysisRepository;
import com.dartinsight.analysis.repository.TextChangeStore;
import com.dartinsight.company.domain.Company;
import com.dartinsight.company.repository.CompanyRepository;
import com.dartinsight.company.service.CompanyImportService;
import com.dartinsight.comparison.domain.ComparisonBasis;
import com.dartinsight.dart.domain.CorpCodeEntry;
import com.dartinsight.document.domain.ReportDocument;
import com.dartinsight.document.dto.StructuredDocumentResponse;
import com.dartinsight.document.dto.StructuredDocumentResponse.Block;
import com.dartinsight.document.dto.StructuredDocumentResponse.Section;
import com.dartinsight.document.repository.DocumentStore;
import com.dartinsight.document.repository.ReportDocumentRepository;
import com.dartinsight.report.domain.Correction;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.domain.ReportNameParser.ParsedReportName;
import com.dartinsight.report.domain.ReportType;
import com.dartinsight.report.repository.ReportRepository;
import com.dartinsight.support.TestData;
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
import org.springframework.test.web.servlet.MockMvc;

/** 문장 변경 이력(3.8, ADR-0028): 완료된 분석을 이어 붙여 글을 따라가고, 알 수 없는 기간을 따로 표시한다 */
@SpringBootTest
@AutoConfigureMockMvc
class TextChangeHistoryTest {

    private static final String CORP = "00000001";
    private static final String Q1_2025 = "20250515000001";
    private static final String HALF_2025 = "20250814000001";
    private static final String Q3_2025 = "20251114000001";
    private static final String ANNUAL_2025 = "20260310000001";
    private static final String Q1_2026 = "20260515000001";
    private static final String HALF_2026 = "20260814000001";
    private static final String Q3_2026 = "20261114000001";
    private static final String PATH = "II. 사업의 내용 > 1. 사업의 개요";
    private static final String OLD = "당사는 메모리를 만듭니다.";
    private static final String NEW = "당사는 메모리와 파운드리를 만듭니다.";
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 21, 9, 0);

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AnalysisResultService resultService;

    @Autowired
    private AnalysisRepository analysisRepository;

    @Autowired
    private TextChangeStore textChangeStore;

    @Autowired
    private ReportDocumentRepository documentRepository;

    @Autowired
    private DocumentStore documentStore;

    @Autowired
    private CompanyImportService companyImportService;

    @Autowired
    private CompanyRepository companyRepository;

    @Autowired
    private ReportRepository reportRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private long selected;

    /**
     * 2025.06 → 2025.09: 글이 추가됨, 2025.09 → 2025.12: 바뀌지 않음, 2025.12 → 2026.06: 수정됨(고른 항목).
     * 2025.03·2026.03·2026.09는 목록에만 있고 분석하지 않았다.
     */
    @BeforeEach
    void setUp() {
        TestData.clearAll(jdbcTemplate);
        companyImportService.save(List.of(new CorpCodeEntry(CORP, "예시전자", null, "900001", LocalDate.of(2026, 1, 1))));
        report(Q1_2025, ReportType.Q1, 2025, LocalDate.of(2025, 3, 31));
        report(HALF_2025, ReportType.HALF, 2025, LocalDate.of(2025, 6, 30));
        report(Q3_2025, ReportType.Q3, 2025, LocalDate.of(2025, 9, 30));
        report(ANNUAL_2025, ReportType.ANNUAL, 2025, LocalDate.of(2025, 12, 31));
        report(Q1_2026, ReportType.Q1, 2026, LocalDate.of(2026, 3, 31));
        report(HALF_2026, ReportType.HALF, 2026, LocalDate.of(2026, 6, 30));
        report(Q3_2026, ReportType.Q3, 2026, LocalDate.of(2026, 9, 30));
        Company company = companyRepository.findByCorpCode(CORP).orElseThrow();
        company.markReportsFetched(NOW);
        companyRepository.save(company);

        analysis(HALF_2025, Q3_2025, TextStatus.COMPLETED,
                row(TextChangeRow.ADDED, null, new Side(Q3_2025, 2, 3, OLD)));
        analysis(Q3_2025, ANNUAL_2025, TextStatus.COMPLETED,
                row(TextChangeRow.ADDED, null, new Side(ANNUAL_2025, 2, 9, "다른 문단")));
        selected = analysis(ANNUAL_2025, HALF_2026, TextStatus.COMPLETED,
                row(TextChangeRow.MODIFIED, new Side(ANNUAL_2025, 2, 4, OLD), new Side(HALF_2026, 2, 5, NEW)));
    }

    @Test
    @DisplayName("완료된 분석을 이어 붙여 오래된 기간부터 추가·유지·수정을 보여 주고, 분석하지 않은 기간은 따로 표시한다")
    void followsTextAcrossCompletedAnalyses() throws Exception {
        document(Q3_2025, "앞 문단", OLD);

        mockMvc.perform(get("/api/analyses/{a}/text-changes/{c}/history", selected, changeId(selected)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entries.length()").value(6))
                // 추가되기 전. 추가를 만나 더 과거(2025.03)로는 가지 않는다
                .andExpect(jsonPath("$.entries[0].report.rceptNo").value(HALF_2025))
                .andExpect(jsonPath("$.entries[0].status").value("ABSENT"))
                .andExpect(jsonPath("$.entries[0].text").value(nullValue()))
                .andExpect(jsonPath("$.entries[1].report.rceptNo").value(Q3_2025))
                .andExpect(jsonPath("$.entries[1].status").value("PRESENT"))
                .andExpect(jsonPath("$.entries[1].change.changeType").value("ADDED"))
                // 바뀌지 않은 다음 분석에서 찾은 원문 블록 위치
                .andExpect(jsonPath("$.entries[1].evidenceId").value(Q3_2025 + "#B2"))
                .andExpect(jsonPath("$.entries[1].sectionPath").value(PATH))
                .andExpect(jsonPath("$.entries[2].report.rceptNo").value(ANNUAL_2025))
                .andExpect(jsonPath("$.entries[2].status").value("PRESENT"))
                .andExpect(jsonPath("$.entries[2].text").value(OLD))
                .andExpect(jsonPath("$.entries[2].evidenceId").value(ANNUAL_2025 + "#B4"))
                .andExpect(jsonPath("$.entries[2].change").value(nullValue()))
                // 고른 분석이 건너뛴 기간
                .andExpect(jsonPath("$.entries[3].report.rceptNo").value(Q1_2026))
                .andExpect(jsonPath("$.entries[3].status").value("NOT_ANALYZED"))
                .andExpect(jsonPath("$.entries[4].report.rceptNo").value(HALF_2026))
                .andExpect(jsonPath("$.entries[4].report.reportType").value("HALF"))
                .andExpect(jsonPath("$.entries[4].report.periodEnd").value("2026-06-30"))
                .andExpect(jsonPath("$.entries[4].status").value("PRESENT"))
                .andExpect(jsonPath("$.entries[4].text").value(NEW))
                .andExpect(jsonPath("$.entries[4].evidenceId").value(HALF_2026 + "#B5"))
                .andExpect(jsonPath("$.entries[4].change.analysisId").value(selected))
                .andExpect(jsonPath("$.entries[4].change.changeType").value("MODIFIED"))
                // 분석이 없어 더 가지 못한 바로 다음 기간
                .andExpect(jsonPath("$.entries[5].report.rceptNo").value(Q3_2026))
                .andExpect(jsonPath("$.entries[5].status").value("NOT_ANALYZED"));
    }

    @Test
    @DisplayName("바뀌지 않은 기간에 저장된 원문이 없으면 글을 보여 주지 않고 검토 필요로 두되, 계속 따라간다")
    void unchangedReportWithoutDocumentNeedsReview() throws Exception {
        mockMvc.perform(get("/api/analyses/{a}/text-changes/{c}/history", selected, changeId(selected)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entries[0].status").value("ABSENT"))
                .andExpect(jsonPath("$.entries[1].report.rceptNo").value(Q3_2025))
                .andExpect(jsonPath("$.entries[1].status").value("REVIEW_NEEDED"))
                .andExpect(jsonPath("$.entries[1].text").value(nullValue()))
                .andExpect(jsonPath("$.entries[1].evidenceId").value(nullValue()))
                .andExpect(jsonPath("$.entries[1].change.changeType").value("ADDED"));
    }

    @Test
    @DisplayName("문장 비교가 실패한 분석은 잇지 않고 분석 안 됨으로 둔다")
    void failedTextComparisonIsNotAnalyzed() throws Exception {
        jdbcTemplate.update("UPDATE analysis SET text_status = 'FAILED' WHERE current_rcept_no = ?", ANNUAL_2025);

        mockMvc.perform(get("/api/analyses/{a}/text-changes/{c}/history", selected, changeId(selected)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entries.length()").value(5))
                .andExpect(jsonPath("$.entries[0].report.rceptNo").value(Q3_2025))
                .andExpect(jsonPath("$.entries[0].status").value("NOT_ANALYZED"))
                .andExpect(jsonPath("$.entries[1].report.rceptNo").value(ANNUAL_2025))
                .andExpect(jsonPath("$.entries[1].status").value("PRESENT"));
    }

    @Test
    @DisplayName("같은 보고서 쌍을 다시 분석해 문장 비교가 실패했으면 그 전의 정상 분석으로 잇는다")
    void skipsNewerFailedAnalysisOfSamePair() throws Exception {
        document(Q3_2025, "앞 문단", OLD);
        analysis(Q3_2025, ANNUAL_2025, TextStatus.FAILED);

        mockMvc.perform(get("/api/analyses/{a}/text-changes/{c}/history", selected, changeId(selected)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entries.length()").value(6))
                .andExpect(jsonPath("$.entries[1].report.rceptNo").value(Q3_2025))
                .andExpect(jsonPath("$.entries[1].status").value("PRESENT"))
                .andExpect(jsonPath("$.entries[1].change.changeType").value("ADDED"));
    }

    @Test
    @DisplayName("다른 분석의 변경 번호면 404다")
    void unknownChangeIsNotFound() throws Exception {
        long other = analysisRepository.findAll().stream()
                .filter(a -> a.getId() != selected).findFirst().orElseThrow().getId();

        mockMvc.perform(get("/api/analyses/{a}/text-changes/{c}/history", selected, changeId(other)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ANALYSIS_TEXT_CHANGE_NOT_FOUND"));
    }

    private void report(String rceptNo, ReportType type, int fiscalYear, LocalDate periodEnd) {
        reportRepository.save(Report.create(rceptNo, CORP, type.label() + " (" + periodEnd.getYear() + "."
                        + String.format("%02d", periodEnd.getMonthValue()) + ")",
                new ParsedReportName(type, fiscalYear, periodEnd, Correction.ORIGINAL),
                periodEnd.plusMonths(2), null, "예시전자", NOW));
    }

    private long analysis(String previous, String current, TextStatus textStatus, TextChangeRow... rows) {
        Analysis analysis = Analysis.request(CORP, current, previous, ComparisonBasis.PREV, null, NOW);
        analysis.start(NOW);
        long id = analysisRepository.save(analysis).getId();
        resultService.saveAndComplete(id, List.of(), new TextComparison(textStatus, null, List.of(rows)));
        return id;
    }

    private void document(String rceptNo, String... paragraphs) {
        List<Block> blocks = new java.util.ArrayList<>();
        for (int i = 0; i < paragraphs.length; i++) {
            blocks.add(new Block(i + 1, "PARAGRAPH", paragraphs[i], null));
        }
        List<Section> sections = List.of(
                new Section(1, null, 1, "II. 사업의 내용", "D-0-2-0-0", false, List.of()),
                new Section(2, 1, 2, "1. 사업의 개요", null, false, blocks));
        StructuredDocumentResponse response = new StructuredDocumentResponse(rceptNo, "dart-xml-1", "STRUCTURED",
                null, null, rceptNo + ".xml", "utf-8", "분기보고서", "예시전자", List.of(), List.of(),
                Map.of("cells", 0, "sourceCells", 0), sections);
        ReportDocument document = documentRepository.save(ReportDocument.structured(rceptNo, response, 100, NOW, NOW));
        documentStore.replace(document.getId(), sections);
    }

    private static TextChangeRow row(String type, Side previous, Side current) {
        return new TextChangeRow(type, "PARAGRAPH", false, "MATCHED", "1. 사업의 개요", PATH, previous, current,
                TextChangeRow.MODIFIED.equals(type) ? new BigDecimal("0.7000") : null, null);
    }

    private long changeId(long analysisId) {
        return textChangeStore.page(analysisId, TextChangeFilter.NONE, false, 0, 1).getFirst().id();
    }
}
