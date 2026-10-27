package com.dartinsight.analysis.controller;

import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.domain.TextChangeRow.Side;
import com.dartinsight.analysis.domain.TextChangeRow;
import com.dartinsight.analysis.domain.TextComparison;
import com.dartinsight.analysis.domain.TextStatus;
import com.dartinsight.analysis.repository.AnalysisRepository;
import com.dartinsight.analysis.service.AnalysisResultService;
import com.dartinsight.company.service.CompanyImportService;
import com.dartinsight.comparison.domain.ComparisonBasis;
import com.dartinsight.dart.domain.CorpCodeEntry;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

/** 문장·표 변경 목록의 위험 관련 거르기·건수·표시(3.9 위험 요인 변화, FS-61) */
@SpringBootTest
@AutoConfigureMockMvc
class TextChangeRiskApiTest {

    private static final String CUR = "20260814000001";
    private static final String PREV = "20250814000001";
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 27, 9, 0);
    private static final String BUSINESS = "II. 사업의 내용";
    private static final String RISK = BUSINESS + " > 5. 위험관리 및 파생거래";
    private static final String OTHER = "XI. 그 밖에 투자자 보호를 위하여 필요한 사항";
    private static final String CONTINGENT = OTHER + " > 2. 우발부채 등에 관한 사항";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AnalysisResultService resultService;

    @Autowired
    private AnalysisRepository analysisRepository;

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
        Analysis analysis = Analysis.request("00000001", CUR, PREV, ComparisonBasis.YOY, null, NOW);
        analysis.start(NOW);
        analysisId = analysisRepository.save(analysis).getId();
        resultService.saveAndComplete(analysisId, List.of(), new TextComparison(TextStatus.COMPLETED, null, List.of(
                added(BUSINESS + " > 1. 사업의 개요", "새 공장을 지었습니다."),
                added(RISK, "환율 변동 위험을 관리합니다."),
                deleted(RISK, "이자율 스왑 계약이 있었습니다."),
                modified(CONTINGENT, "채무보증 1건", "채무보증 2건"),
                modified(CONTINGENT + " > 가. 중요한 소송사건", "소송 1건이 진행 중입니다.", "소송이 끝났습니다."),
                added(OTHER + " > 1. 공시내용 진행 및 변경사항", "공시 내용이 바뀌었습니다."),
                moved(BUSINESS + " > 7. 기타 참고사항", RISK, "옮겨진 문단입니다."))));
    }

    private static TextChangeRow added(String path, String text) {
        return new TextChangeRow(TextChangeRow.ADDED, "PARAGRAPH", false, "MATCHED", last(path), path, null,
                new Side(CUR, 2, 1, text), null, null);
    }

    private static TextChangeRow deleted(String path, String text) {
        return new TextChangeRow(TextChangeRow.DELETED, "PARAGRAPH", false, "MATCHED", last(path), path,
                new Side(PREV, 2, 1, text), null, null, null);
    }

    private static TextChangeRow modified(String path, String before, String after) {
        return new TextChangeRow(TextChangeRow.MODIFIED, "PARAGRAPH", false, "MATCHED", last(path), path,
                new Side(PREV, 3, 1, before), new Side(CUR, 3, 1, after), new BigDecimal("0.5000"), null);
    }

    /** 위험 관련 목차(previousPath)에서 다른 목차(path)로 옮겨진 글 */
    private static TextChangeRow moved(String path, String previousPath, String text) {
        return new TextChangeRow(TextChangeRow.MOVED, "PARAGRAPH", false, "MATCHED", last(path), path,
                new Side(PREV, 4, 1, text), new Side(CUR, 5, 1, text), BigDecimal.ONE, null, null, previousPath);
    }

    private static String last(String path) {
        String[] parts = path.split(" > ");
        return parts[parts.length - 1];
    }

    @Test
    @DisplayName("거르지 않으면 항목마다 위험 관련 표시와 위험 관련 유형별 건수를 준다")
    void marksRiskRelatedItemsAndCountsThem() throws Exception {
        mockMvc.perform(get("/api/analyses/{id}/text-changes", analysisId).param("sort", "document"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.risk").value(false))
                .andExpect(jsonPath("$.totalItems").value(7))
                .andExpect(jsonPath("$.counts.all").value(7))
                .andExpect(jsonPath("$.riskCounts.all").value(5))
                .andExpect(jsonPath("$.riskCounts.added").value(1))
                .andExpect(jsonPath("$.riskCounts.deleted").value(1))
                .andExpect(jsonPath("$.riskCounts.modified").value(2))
                .andExpect(jsonPath("$.riskCounts.moved").value(1))
                .andExpect(jsonPath("$.riskCounts.numericUpdate").value(0))
                .andExpect(jsonPath("$.riskCounts.reviewNeeded").value(0))
                .andExpect(jsonPath("$.items[0].riskRelated").value(false))
                .andExpect(jsonPath("$.items[1].riskRelated").value(true))
                .andExpect(jsonPath("$.items[5].riskRelated").value(false))
                // 옮기기 전 목차가 위험 관련이면 위험 관련이다
                .andExpect(jsonPath("$.items[6].changeType").value("MOVED"))
                .andExpect(jsonPath("$.items[6].riskRelated").value(true));
    }

    @Test
    @DisplayName("risk=true면 위험 관련만 주고 유형별·섹션별 건수도 그 안에서 센다")
    void filtersRiskRelatedOnly() throws Exception {
        mockMvc.perform(get("/api/analyses/{id}/text-changes", analysisId)
                        .param("risk", "true").param("sort", "document"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.risk").value(true))
                .andExpect(jsonPath("$.totalItems").value(5))
                .andExpect(jsonPath("$.items", hasSize(5)))
                .andExpect(jsonPath("$.items[*].riskRelated", everyItem(is(true))))
                .andExpect(jsonPath("$.items[0].sectionPath").value(RISK))
                .andExpect(jsonPath("$.counts.all").value(5))
                .andExpect(jsonPath("$.counts.added").value(1))
                .andExpect(jsonPath("$.riskCounts.all").value(5))
                .andExpect(jsonPath("$.sections", hasSize(2)))
                .andExpect(jsonPath("$.sections[0].title").value(BUSINESS))
                .andExpect(jsonPath("$.sections[0].count").value(3))
                .andExpect(jsonPath("$.sections[1].title").value(OTHER))
                .andExpect(jsonPath("$.sections[1].count").value(2));
    }

    @Test
    @DisplayName("risk는 유형·섹션·검색어·쪽 나누기와 함께 쓴다")
    void combinesWithOtherFilters() throws Exception {
        mockMvc.perform(get("/api/analyses/{id}/text-changes", analysisId)
                        .param("risk", "true").param("type", "MODIFIED").param("section", OTHER))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(2))
                .andExpect(jsonPath("$.items", hasSize(2)))
                // 위험 관련 건수는 유형을 보지 않고 섹션 안에서 센다
                .andExpect(jsonPath("$.riskCounts.all").value(2))
                .andExpect(jsonPath("$.riskCounts.modified").value(2));
        mockMvc.perform(get("/api/analyses/{id}/text-changes", analysisId)
                        .param("risk", "true").param("q", "끝났").param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].sectionPath").value(CONTINGENT + " > 가. 중요한 소송사건"));
    }

    @Test
    @DisplayName("위험 관련 변경이 없는 섹션으로 거르면 위험 관련 건수가 0이다")
    void countsZeroWithoutRiskChanges() throws Exception {
        mockMvc.perform(get("/api/analyses/{id}/text-changes", analysisId)
                        .param("section", BUSINESS).param("q", "공장"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.riskCounts.all").value(0))
                .andExpect(jsonPath("$.riskCounts.added").value(0));
    }

    @Test
    @DisplayName("risk가 참·거짓이 아니면 400")
    void rejectsInvalidRisk() throws Exception {
        mockMvc.perform(get("/api/analyses/{id}/text-changes", analysisId).param("risk", "maybe"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"));
    }
}
