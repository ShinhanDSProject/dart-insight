package com.dartinsight.analysis.controller;

import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.hasSize;
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

/** 유형 여러 개 거르기(#304). 화면의 '내용 변경'은 ADDED,DELETED,MODIFIED */
@SpringBootTest
@AutoConfigureMockMvc
class TextChangeMultiTypeApiTest {

    private static final String CUR = "20260814000001";
    private static final String PREV = "20250814000001";
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 25, 9, 0);
    private static final String COMPANY = "I. 회사의 개요";
    private static final String BUSINESS = "II. 사업의 내용";
    private static final String HISTORY = COMPANY + " > 2. 회사의 연혁";
    private static final String PRODUCTS = BUSINESS + " > 2. 주요 제품";
    private static final String CONTENT = "ADDED,DELETED,MODIFIED";

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
        String moved = "당사는 미국 텍사스주에 반도체 공장을 짓고 있습니다.";
        TextComparison text = new TextComparison(TextStatus.COMPLETED, null, List.of(
                new TextChangeRow(TextChangeRow.DELETED, "PARAGRAPH", false, "MATCHED", "2. 회사의 연혁", HISTORY,
                        new Side(PREV, 1, 2, "지운 문장입니다."), null, null, null),
                new TextChangeRow(TextChangeRow.MOVED, "PARAGRAPH", false, "MATCHED", "2. 회사의 연혁", HISTORY,
                        new Side(PREV, 2, 5, moved), new Side(CUR, 1, 3, moved), new BigDecimal("1.0000"), null,
                        null, PRODUCTS),
                new TextChangeRow(TextChangeRow.ADDED, "PARAGRAPH", false, "MATCHED", "2. 주요 제품", PRODUCTS,
                        null, new Side(CUR, 2, 6, "새 문장입니다."), null, null),
                new TextChangeRow(TextChangeRow.MODIFIED, "PARAGRAPH", false, "MATCHED", "2. 주요 제품", PRODUCTS,
                        new Side(PREV, 2, 7, "당사는 메모리를 만듭니다."), new Side(CUR, 2, 7, "당사는 파운드리도 합니다."),
                        new BigDecimal("0.5000"), null),
                new TextChangeRow(TextChangeRow.NUMERIC_UPDATE, "TABLE", true, "MATCHED", "2. 주요 제품", PRODUCTS,
                        new Side(PREV, 2, 10, "DRAM | 1,000"), new Side(CUR, 2, 11, "DRAM | 1,250"),
                        new BigDecimal("0.9000"), null)));
        Analysis analysis = Analysis.request("00000001", CUR, PREV, ComparisonBasis.YOY, null, NOW);
        analysis.start(NOW);
        analysisId = analysisRepository.save(analysis).getId();
        resultService.saveAndComplete(analysisId, List.of(), text);
    }

    @Test
    @DisplayName("유형 두 개를 쉼표로 주면 그중 하나에 맞는 변경만 돌려준다")
    void filtersByTwoTypes() throws Exception {
        mockMvc.perform(get("/api/analyses/{id}/text-changes", analysisId).param("type", "ADDED,DELETED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.type").value("ADDED,DELETED"))
                .andExpect(jsonPath("$.totalItems").value(2))
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.items[*].changeType", containsInAnyOrder("ADDED", "DELETED")))
                .andExpect(jsonPath("$.counts.all").value(5));
    }

    @Test
    @DisplayName("내용 변경(추가·삭제·수정) 세 유형을 주면 숫자만 바뀜·위치 이동은 빠진다")
    void filtersByThreeContentTypes() throws Exception {
        mockMvc.perform(get("/api/analyses/{id}/text-changes", analysisId).param("type", CONTENT))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.type").value(CONTENT))
                .andExpect(jsonPath("$.totalItems").value(3))
                .andExpect(jsonPath("$.items[*].changeType", containsInAnyOrder("ADDED", "DELETED", "MODIFIED")))
                .andExpect(jsonPath("$.counts.all").value(5))
                .andExpect(jsonPath("$.counts.numericUpdate").value(1))
                .andExpect(jsonPath("$.counts.moved").value(1));
    }

    @Test
    @DisplayName("섹션별 건수는 여러 유형 거르기에 맞는 것만 센다")
    void sectionCountsRespectMultipleTypes() throws Exception {
        mockMvc.perform(get("/api/analyses/{id}/text-changes", analysisId).param("type", CONTENT))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sections", hasSize(2)))
                .andExpect(jsonPath("$.sections[0].title").value(COMPANY))
                .andExpect(jsonPath("$.sections[0].count").value(1))
                .andExpect(jsonPath("$.sections[1].title").value(BUSINESS))
                .andExpect(jsonPath("$.sections[1].count").value(2));
        mockMvc.perform(get("/api/analyses/{id}/text-changes", analysisId).param("type", CONTENT)
                .param("section", BUSINESS))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(2))
                .andExpect(jsonPath("$.items[*].changeType", containsInAnyOrder("ADDED", "MODIFIED")));
    }

    @Test
    @DisplayName("값마다 공백을 지우고 겹친 값은 한 번만 쓴다")
    void trimsAndDeduplicatesTypes() throws Exception {
        mockMvc.perform(get("/api/analyses/{id}/text-changes", analysisId).param("type", "MOVED, ADDED,MOVED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.type").value("MOVED,ADDED"))
                .andExpect(jsonPath("$.totalItems").value(2))
                .andExpect(jsonPath("$.items", hasSize(2)));
    }

    @Test
    @DisplayName("유형 하나는 지금과 같이 거른다")
    void keepsSingleTypeBehaviour() throws Exception {
        mockMvc.perform(get("/api/analyses/{id}/text-changes", analysisId).param("type", "MODIFIED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.type").value("MODIFIED"))
                .andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].changeType").value("MODIFIED"))
                .andExpect(jsonPath("$.sections[0].count").value(0))
                .andExpect(jsonPath("$.sections[1].count").value(1));
    }

    @Test
    @DisplayName("빈 type은 거르지 않는다")
    void treatsBlankTypeAsAll() throws Exception {
        mockMvc.perform(get("/api/analyses/{id}/text-changes", analysisId).param("type", " "))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.type").doesNotExist())
                .andExpect(jsonPath("$.totalItems").value(5));
    }

    @Test
    @DisplayName("알 수 없는 값이나 빈 항목이 하나라도 있으면 400이다")
    void rejectsAnyUnknownType() throws Exception {
        for (String type : new String[] {"ADDED,REORDERED", "ADDED,", "added"}) {
            mockMvc.perform(get("/api/analyses/{id}/text-changes", analysisId).param("type", type))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"))
                    .andExpect(jsonPath("$.errors[0].field").value("type"));
        }
    }
}
