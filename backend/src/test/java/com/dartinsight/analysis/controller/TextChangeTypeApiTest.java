package com.dartinsight.analysis.controller;

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

/** 숫자만 바뀜(NUMERIC_UPDATE)·위치 이동(MOVED) 유형의 목록·거르기·건수(#150) */
@SpringBootTest
@AutoConfigureMockMvc
class TextChangeTypeApiTest {

    private static final String CUR = "20260814000001";
    private static final String PREV = "20250814000001";
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 25, 9, 0);
    private static final String OVERVIEW = "II. 사업의 내용 > 1. 사업의 개요";
    private static final String PRODUCTS = "II. 사업의 내용 > 2. 주요 제품";

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
                new TextChangeRow(TextChangeRow.NUMERIC_UPDATE, "TABLE", true, "MATCHED", "2. 주요 제품", PRODUCTS,
                        new Side(PREV, 3, 10, "DRAM | 1,000"), new Side(CUR, 3, 11, "DRAM | 1,250"),
                        new BigDecimal("0.9000"), null),
                new TextChangeRow(TextChangeRow.MOVED, "PARAGRAPH", false, "MATCHED", "2. 주요 제품", PRODUCTS,
                        new Side(PREV, 2, 5, moved), new Side(CUR, 3, 12, moved), new BigDecimal("1.0000"), null,
                        null, OVERVIEW),
                new TextChangeRow(TextChangeRow.ADDED, "PARAGRAPH", false, "MATCHED", "1. 사업의 개요", OVERVIEW,
                        null, new Side(CUR, 2, 6, "새 문장입니다."), null, null)));
        Analysis analysis = Analysis.request("00000001", CUR, PREV, ComparisonBasis.YOY, null, NOW);
        analysis.start(NOW);
        analysisId = analysisRepository.save(analysis).getId();
        resultService.saveAndComplete(analysisId, List.of(), text);
    }

    @Test
    @DisplayName("새 유형은 건수에 따로 세고, 위치 이동은 이전 쪽 섹션 경로와 두 쪽 미리보기를 함께 준다")
    void countsNewTypesAndReturnsBothSidesOfAMove() throws Exception {
        mockMvc.perform(get("/api/analyses/{id}/text-changes", analysisId).param("sort", "document"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.counts.all").value(3))
                .andExpect(jsonPath("$.counts.numericUpdate").value(1))
                .andExpect(jsonPath("$.counts.moved").value(1))
                .andExpect(jsonPath("$.counts.added").value(1))
                .andExpect(jsonPath("$.counts.modified").value(0))
                .andExpect(jsonPath("$.items[0].changeType").value("NUMERIC_UPDATE"))
                .andExpect(jsonPath("$.items[0].numbersOnly").value(true))
                .andExpect(jsonPath("$.items[0].previousSectionPath").doesNotExist())
                .andExpect(jsonPath("$.items[1].changeType").value("MOVED"))
                .andExpect(jsonPath("$.items[1].numbersOnly").value(false))
                .andExpect(jsonPath("$.items[1].sectionPath").value(PRODUCTS))
                .andExpect(jsonPath("$.items[1].previousSectionPath").value(OVERVIEW))
                .andExpect(jsonPath("$.items[1].previousPreview").isNotEmpty())
                .andExpect(jsonPath("$.items[1].currentPreview").isNotEmpty());
    }

    @Test
    @DisplayName("유형 거르기에 NUMERIC_UPDATE와 MOVED를 쓸 수 있다")
    void filtersByNewTypes() throws Exception {
        mockMvc.perform(get("/api/analyses/{id}/text-changes", analysisId).param("type", "MOVED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.type").value("MOVED"))
                .andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].changeType").value("MOVED"));
        mockMvc.perform(get("/api/analyses/{id}/text-changes", analysisId).param("type", "NUMERIC_UPDATE"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items[0].changeType").value("NUMERIC_UPDATE"));
    }

    @Test
    @DisplayName("모르는 유형은 400이다")
    void rejectsUnknownType() throws Exception {
        mockMvc.perform(get("/api/analyses/{id}/text-changes", analysisId).param("type", "REORDERED"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"))
                .andExpect(jsonPath("$.errors[0].field").value("type"));
    }
}
