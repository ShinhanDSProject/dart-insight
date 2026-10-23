package com.dartinsight.analysis.controller;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.repository.AnalysisRepository;
import com.dartinsight.analysis.service.AnalysisResultService;
import com.dartinsight.company.service.CompanyImportService;
import com.dartinsight.comparison.domain.ComparisonBasis;
import com.dartinsight.dart.dto.CorpCodeEntry;
import com.dartinsight.document.repository.DocumentStore;
import com.dartinsight.document.domain.ReportDocument;
import com.dartinsight.document.repository.ReportDocumentRepository;
import com.dartinsight.document.dto.StructuredDocumentResponse;
import com.dartinsight.document.dto.StructuredDocumentResponse.Block;
import com.dartinsight.document.dto.StructuredDocumentResponse.Cell;
import com.dartinsight.document.dto.StructuredDocumentResponse.Section;
import com.dartinsight.report.domain.Correction;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.service.ReportNameParser.ParsedReportName;
import com.dartinsight.report.repository.ReportRepository;
import com.dartinsight.report.domain.ReportType;
import com.dartinsight.support.TestData;
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

/** 앱 안 원문 확인(3.5): 분석의 두 보고서 목차와 섹션 원문 */
@SpringBootTest
@AutoConfigureMockMvc
class SourceApiTest {

    private static final String CUR = "20260814000001";
    private static final String PREV = "20250814000001";
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 21, 9, 0);

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AnalysisRepository analysisRepository;

    @Autowired
    private AnalysisResultService resultService;

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
        List<Section> sections = List.of(
                new Section(1, null, 1, "사 업 보 고 서", null, true, List.of(new Block(1, "PARAGRAPH", "표지", null))),
                new Section(2, null, 1, "II. 사업의 내용", "D-0-2-0-0", false, List.of()),
                new Section(3, 2, 2, "1. 사업의 개요", null, false, List.of(
                        new Block(2, "PARAGRAPH", "당사는 메모리를 만듭니다.", null),
                        new Block(3, "TABLE", "구분 | 금액", List.of(
                                List.of(new Cell("구분", true, null, null), new Cell("금액", true, null, null)))))));
        StructuredDocumentResponse response = new StructuredDocumentResponse(CUR, "dart-xml-1", "STRUCTURED", null,
                null, CUR + ".xml", "utf-8", "반기보고서", "예시전자", List.of(), List.of(),
                Map.of("cells", 2, "sourceCells", 2), sections);
        ReportDocument document = documentRepository.save(ReportDocument.structured(CUR, response, 100, NOW, NOW));
        documentStore.replace(document.getId(), sections);
        analysisId = analysisRepository.save(
                Analysis.request("00000001", CUR, PREV, ComparisonBasis.YOY, null, NOW)).getId();
    }

    @Test
    void outlineListsSectionsAndSaysPositionLinksAreNotSupported() throws Exception {
        mockMvc.perform(get("/api/analyses/{a}/documents/current", analysisId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.side").value("current"))
                .andExpect(jsonPath("$.rceptNo").value(CUR))
                .andExpect(jsonPath("$.reportName").value("반기보고서 (2026.06)"))
                .andExpect(jsonPath("$.documentStatus").value("STRUCTURED"))
                .andExpect(jsonPath("$.statusMessage").doesNotExist())
                .andExpect(jsonPath("$.positionLinkSupported").value(false))
                .andExpect(jsonPath("$.restructuredAfterAnalysis").value(false))
                .andExpect(jsonPath("$.dartUrl").value("https://dart.fss.or.kr/dsaf001/main.do?rcpNo=" + CUR))
                .andExpect(jsonPath("$.sections", hasSize(3)))
                .andExpect(jsonPath("$.sections[0].cover").value(true))
                .andExpect(jsonPath("$.sections[2].parentNo").value(2))
                .andExpect(jsonPath("$.sections[2].depth").value(2))
                .andExpect(jsonPath("$.sections[2].blockCount").value(2));
    }

    @Test
    void documentStructuredAgainAfterTheAnalysisIsFlagged() throws Exception {
        Analysis analysis = analysisRepository.findById(analysisId).orElseThrow();
        analysis.start(NOW.minusHours(2));
        analysisRepository.save(analysis);
        resultService.saveAndComplete(analysisId, List.of());
        jdbcTemplate.update("UPDATE analysis SET completed_at = ? WHERE id = ?", NOW.minusHours(1), analysisId);

        mockMvc.perform(get("/api/analyses/{a}/documents/current", analysisId))
                .andExpect(jsonPath("$.restructuredAfterAnalysis").value(true));
    }

    @Test
    void reportWithoutDocumentIsNotFetchedYet() throws Exception {
        mockMvc.perform(get("/api/analyses/{a}/documents/previous", analysisId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rceptNo").value(PREV))
                .andExpect(jsonPath("$.documentStatus").value("NOT_FETCHED"))
                .andExpect(jsonPath("$.statusMessage").isNotEmpty())
                .andExpect(jsonPath("$.sections", hasSize(0)));
    }

    @Test
    void sectionShowsBlocksWithEvidenceIdsAndTables() throws Exception {
        mockMvc.perform(get("/api/analyses/{a}/documents/current/sections/3", analysisId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sectionPath").value("II. 사업의 내용 > 1. 사업의 개요"))
                .andExpect(jsonPath("$.blocks", hasSize(2)))
                .andExpect(jsonPath("$.blocks[0].evidenceId").value(CUR + "#B2"))
                .andExpect(jsonPath("$.blocks[0].table").doesNotExist())
                .andExpect(jsonPath("$.blocks[1].type").value("TABLE"))
                .andExpect(jsonPath("$.blocks[1].table[0][1].text").value("금액"));
    }

    @Test
    void badSideAndUnknownSectionAreRejected() throws Exception {
        mockMvc.perform(get("/api/analyses/{a}/documents/other", analysisId))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("side"));
        mockMvc.perform(get("/api/analyses/{a}/documents/current/sections/99", analysisId))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("REPORT_SECTION_NOT_FOUND"));
        mockMvc.perform(get("/api/analyses/{a}/documents/previous/sections/1", analysisId))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/analyses/{a}/documents/current", 999_999))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ANALYSIS_NOT_FOUND"));
    }
}
