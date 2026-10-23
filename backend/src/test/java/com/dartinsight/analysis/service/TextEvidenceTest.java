package com.dartinsight.analysis.service;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.domain.TextChangeFilter;
import com.dartinsight.analysis.domain.TextChangeRow.Side;
import com.dartinsight.analysis.domain.TextChangeRow;
import com.dartinsight.analysis.domain.TextComparison;
import com.dartinsight.analysis.domain.TextStatus;
import com.dartinsight.analysis.repository.AnalysisRepository;
import com.dartinsight.analysis.repository.TextChangeStore;
import com.dartinsight.company.service.CompanyImportService;
import com.dartinsight.comparison.domain.ComparisonBasis;
import com.dartinsight.dart.domain.CorpCodeEntry;
import com.dartinsight.document.repository.DocumentStore;
import com.dartinsight.document.domain.ReportDocument;
import com.dartinsight.document.repository.ReportDocumentRepository;
import com.dartinsight.document.dto.StructuredDocumentResponse;
import com.dartinsight.document.dto.StructuredDocumentResponse.Block;
import com.dartinsight.document.dto.StructuredDocumentResponse.Cell;
import com.dartinsight.document.dto.StructuredDocumentResponse.Section;
import com.dartinsight.report.domain.Correction;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.domain.ReportNameParser.ParsedReportName;
import com.dartinsight.report.repository.ReportRepository;
import com.dartinsight.report.domain.ReportType;
import com.dartinsight.support.TestData;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

/** 문장·표 근거 상세(3.4): 두 원문의 글·표, 보고서·항목·위치, 저장된 원문과 맞는지 */
@SpringBootTest
@AutoConfigureMockMvc
class TextEvidenceTest {

    private static final String CUR = "20260814000001";
    private static final String PREV = "20250814000001";
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
    private ReportRepository reportRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private Long analysisId;

    @BeforeEach
    void setUp() {
        TestData.clearAll(jdbcTemplate);
        companyImportService.save(List.of(
                new CorpCodeEntry("00000001", "예시전자", null, "900001", LocalDate.of(2026, 1, 1))));
        for (int year : new int[] {2025, 2026}) {
            reportRepository.save(Report.create(year == 2026 ? CUR : PREV, "00000001", "반기보고서 (" + year + ".06)",
                    new ParsedReportName(ReportType.HALF, year, LocalDate.of(year, 6, 30), Correction.ORIGINAL),
                    LocalDate.of(year, 8, 14), null, "예시전자", NOW));
        }
        saveDocument(PREV, "당사는 메모리를 만듭니다.", "1,000");
        saveDocument(CUR, "당사는 메모리와 파운드리를 만듭니다.", "1,200");
        Analysis analysis = Analysis.request("00000001", CUR, PREV, ComparisonBasis.YOY, null, NOW);
        analysis.start(NOW);
        analysisId = analysisRepository.save(analysis).getId();
        resultService.saveAndComplete(analysisId, List.of(), new TextComparison(TextStatus.COMPLETED, null, List.of(
                row(TextChangeRow.MODIFIED, "PARAGRAPH", new Side(PREV, 2, 1, "당사는 메모리를 만듭니다."),
                        new Side(CUR, 2, 1, "당사는 메모리와 파운드리를 만듭니다."), null),
                row(TextChangeRow.MODIFIED, "TABLE", new Side(PREV, 2, 2, "구분 | 금액\n매출 | 1,000"),
                        new Side(CUR, 2, 2, "구분 | 금액\n매출 | 1,200"), null),
                row(TextChangeRow.ADDED, "PARAGRAPH", null, new Side(CUR, 2, 1, "분석 뒤에 원문이 바뀐 글"), null),
                row(TextChangeRow.REVIEW_NEEDED, TextChangeRow.SECTION, null, new Side(CUR, 1, null, null),
                        "짝을 정하지 못했어요."))));
    }

    private void saveDocument(String rceptNo, String paragraph, String amount) {
        List<Section> sections = List.of(
                new Section(1, null, 1, "II. 사업의 내용", "D-0-2-0-0", false, List.of()),
                new Section(2, 1, 2, "1. 사업의 개요", null, false, List.of(
                        new Block(1, "PARAGRAPH", paragraph, null),
                        new Block(2, "TABLE", "구분 | 금액\n매출 | " + amount, List.of(
                                List.of(new Cell("구분", true, null, null), new Cell("금액", true, null, null)),
                                List.of(new Cell("매출", null, null, null), new Cell(amount, null, null, null)))))));
        StructuredDocumentResponse response = new StructuredDocumentResponse(rceptNo, "dart-xml-1", "STRUCTURED",
                null, null, rceptNo + ".xml", "utf-8", "반기보고서", "예시전자", List.of(), List.of(),
                Map.of("cells", 4, "sourceCells", 4), sections);
        ReportDocument document = documentRepository.save(ReportDocument.structured(rceptNo, response, 100, NOW, NOW));
        documentStore.replace(document.getId(), sections);
    }

    private static TextChangeRow row(String type, String blockType, Side previous, Side current, String reason) {
        return new TextChangeRow(type, blockType, false, "MATCHED", "1. 사업의 개요", "II. 사업의 내용 > 1. 사업의 개요",
                previous, current, TextChangeRow.MODIFIED.equals(type) ? new BigDecimal("0.7000") : null, reason);
    }

    private long changeId(int changeNo) {
        return textChangeStore.page(analysisId, TextChangeFilter.NONE, false, changeNo - 1, 1).getFirst().id();
    }

    @Test
    void paragraphSidesComeWithReportSectionAndPosition() throws Exception {
        mockMvc.perform(get("/api/analyses/{a}/text-changes/{c}", analysisId, changeId(1)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.change.changeType").value("MODIFIED"))
                .andExpect(jsonPath("$.previous.rceptNo").value(PREV))
                .andExpect(jsonPath("$.previous.reportName").value("반기보고서 (2025.06)"))
                .andExpect(jsonPath("$.previous.reportType").value("HALF"))
                .andExpect(jsonPath("$.previous.periodEnd").value("2025-06-30"))
                .andExpect(jsonPath("$.previous.sectionPath").value("II. 사업의 내용 > 1. 사업의 개요"))
                .andExpect(jsonPath("$.previous.blockNo").value(1))
                .andExpect(jsonPath("$.previous.evidenceId").value(PREV + "#B1"))
                .andExpect(jsonPath("$.previous.text").value("당사는 메모리를 만듭니다."))
                .andExpect(jsonPath("$.previous.table").doesNotExist())
                .andExpect(jsonPath("$.previous.blockMatches").value(true))
                .andExpect(jsonPath("$.previous.dartUrl").value("https://dart.fss.or.kr/dsaf001/main.do?rcpNo=" + PREV))
                .andExpect(jsonPath("$.current.text").value("당사는 메모리와 파운드리를 만듭니다."));
    }

    @Test
    void tableSideCarriesItsCells() throws Exception {
        mockMvc.perform(get("/api/analyses/{a}/text-changes/{c}", analysisId, changeId(2)))
                .andExpect(jsonPath("$.current.blockType").value("TABLE"))
                .andExpect(jsonPath("$.current.table[0][0].text").value("구분"))
                .andExpect(jsonPath("$.current.table[0][0].header").value(true))
                .andExpect(jsonPath("$.current.table[1][1].text").value("1,200"));
    }

    @Test
    void textThatNoLongerMatchesTheStoredBlockIsShownAsSavedWithoutCells() throws Exception {
        mockMvc.perform(get("/api/analyses/{a}/text-changes/{c}", analysisId, changeId(3)))
                .andExpect(jsonPath("$.previous").doesNotExist())
                .andExpect(jsonPath("$.current.text").value("분석 뒤에 원문이 바뀐 글"))
                .andExpect(jsonPath("$.current.blockMatches").value(false))
                .andExpect(jsonPath("$.current.table").doesNotExist());
    }

    @Test
    void reviewNeededHasNoBlockEvidence() throws Exception {
        mockMvc.perform(get("/api/analyses/{a}/text-changes/{c}", analysisId, changeId(4)))
                .andExpect(jsonPath("$.change.reviewReason").value("짝을 정하지 못했어요."))
                .andExpect(jsonPath("$.current.sectionPath").value("II. 사업의 내용"))
                .andExpect(jsonPath("$.current.blockNo").doesNotExist())
                .andExpect(jsonPath("$.current.evidenceId").doesNotExist());
    }

    @Test
    void changeOfAnotherAnalysisIsNotFound() throws Exception {
        Analysis other = Analysis.request("00000001", CUR, PREV, ComparisonBasis.CUSTOM, null, NOW);
        other.start(NOW);
        Long otherId = analysisRepository.save(other).getId();
        resultService.saveAndComplete(otherId, List.of(), TextComparison.failed("비교 안 함"));

        mockMvc.perform(get("/api/analyses/{a}/text-changes/{c}", otherId, changeId(1)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ANALYSIS_TEXT_CHANGE_NOT_FOUND"));
    }
}
