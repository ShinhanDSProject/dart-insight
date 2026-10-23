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

/** 문장·표 변경 목록의 섹션 거르기·검색(3.7) */
@SpringBootTest
@AutoConfigureMockMvc
class TextChangeFilterApiTest {

    private static final String CUR = "20260814000001";
    private static final String PREV = "20250814000001";
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 21, 9, 0);
    private static final String BUSINESS = "II. 사업의 내용";
    private static final String OTHER = "XI. 그 밖에 투자자 보호를 위하여 필요한 사항";

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
                added("I. 회사의 개요 > 1. 회사의 개요", "본점을 옮겼습니다."),
                added(BUSINESS, "사업의 내용 머리말이 새로 들어갔습니다."),
                added(BUSINESS + " > 1. 사업의 개요", "Apple과 공급 계약을 맺었습니다."),
                deleted(BUSINESS + " > 2. 주요 제품", "할인율 100%인 제품이 있었습니다."),
                added("II. 사업의 내용확장 > 1. 기타", "이름이 비슷한 다른 섹션입니다."),
                added(OTHER + " > 3. 제재 등과 관련된 사항", "과징금 제재를 받았습니다."))));
    }

    private static TextChangeRow added(String path, String text) {
        return new TextChangeRow(TextChangeRow.ADDED, "PARAGRAPH", false, "MATCHED", last(path), path, null,
                new Side(CUR, 2, 1, text), null, null);
    }

    private static TextChangeRow deleted(String path, String text) {
        return new TextChangeRow(TextChangeRow.DELETED, "PARAGRAPH", false, "MATCHED", last(path), path,
                new Side(PREV, 2, 1, text), null, null, null);
    }

    private static String last(String path) {
        String[] parts = path.split(" > ");
        return parts[parts.length - 1];
    }

    @Test
    @DisplayName("섹션 목록은 최상위 섹션별 건수를 문서 순서로 준다")
    void listsTopLevelSectionsWithCountsInDocumentOrder() throws Exception {
        mockMvc.perform(get("/api/analyses/{id}/text-changes", analysisId).param("sort", "document"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.section").doesNotExist())
                .andExpect(jsonPath("$.q").doesNotExist())
                .andExpect(jsonPath("$.sections", hasSize(4)))
                .andExpect(jsonPath("$.sections[0].title").value("I. 회사의 개요"))
                .andExpect(jsonPath("$.sections[0].count").value(1))
                .andExpect(jsonPath("$.sections[1].title").value(BUSINESS))
                .andExpect(jsonPath("$.sections[1].count").value(3))
                .andExpect(jsonPath("$.sections[2].title").value("II. 사업의 내용확장"))
                .andExpect(jsonPath("$.sections[3].title").value(OTHER))
                .andExpect(jsonPath("$.sections[3].count").value(1));
    }

    @Test
    @DisplayName("섹션을 고르면 그 섹션과 하위 섹션의 변경만 주고 건수도 그 안에서 센다")
    void filtersBySectionIncludingSubsections() throws Exception {
        mockMvc.perform(get("/api/analyses/{id}/text-changes", analysisId)
                        .param("section", BUSINESS).param("sort", "document"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.section").value(BUSINESS))
                .andExpect(jsonPath("$.totalItems").value(3))
                .andExpect(jsonPath("$.counts.all").value(3))
                .andExpect(jsonPath("$.counts.added").value(2))
                .andExpect(jsonPath("$.counts.deleted").value(1))
                .andExpect(jsonPath("$.items", hasSize(3)))
                .andExpect(jsonPath("$.items[0].sectionPath").value(BUSINESS))
                .andExpect(jsonPath("$.items[1].sectionPath").value(BUSINESS + " > 1. 사업의 개요"))
                .andExpect(jsonPath("$.items[2].sectionPath").value(BUSINESS + " > 2. 주요 제품"))
                // 섹션 목록은 섹션 조건 없이 센다(다른 섹션으로 바로 옮겨 갈 수 있게)
                .andExpect(jsonPath("$.sections", hasSize(4)));
    }

    @Test
    @DisplayName("섹션과 유형을 함께 고르면 둘 다 맞는 변경만 준다")
    void combinesSectionAndType() throws Exception {
        mockMvc.perform(get("/api/analyses/{id}/text-changes", analysisId)
                        .param("section", BUSINESS).param("type", "DELETED"))
                .andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items[0].previousPreview").value("할인율 100%인 제품이 있었습니다."))
                .andExpect(jsonPath("$.counts.added").value(2))
                .andExpect(jsonPath("$.sections[1].count").value(1))
                .andExpect(jsonPath("$.sections[0].count").value(0));
    }

    @Test
    @DisplayName("검색어는 전·후 글과 섹션 경로에서 대소문자 없이 찾는다")
    void searchesTextAndPathIgnoringCase() throws Exception {
        mockMvc.perform(get("/api/analyses/{id}/text-changes", analysisId).param("q", "  apple "))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.q").value("apple"))
                .andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items[0].currentPreview").value("Apple과 공급 계약을 맺었습니다."));
        mockMvc.perform(get("/api/analyses/{id}/text-changes", analysisId).param("q", "제재 등"))
                .andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.sections[3].count").value(1))
                .andExpect(jsonPath("$.sections[1].count").value(0));
        // 삭제된 쪽(이전 글)도 찾고, %는 글자 그대로 찾는다
        mockMvc.perform(get("/api/analyses/{id}/text-changes", analysisId).param("q", "0%인"))
                .andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.counts.deleted").value(1));
        mockMvc.perform(get("/api/analyses/{id}/text-changes", analysisId).param("q", "%%"))
                .andExpect(jsonPath("$.totalItems").value(0))
                .andExpect(jsonPath("$.items", hasSize(0)));
    }

    @Test
    @DisplayName("없는 섹션이면 빈 목록이고 빈 값은 거르지 않는다")
    void unknownSectionIsEmptyAndBlankIsIgnored() throws Exception {
        mockMvc.perform(get("/api/analyses/{id}/text-changes", analysisId).param("section", "IX. 없는 섹션"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(0))
                .andExpect(jsonPath("$.counts.all").value(0));
        mockMvc.perform(get("/api/analyses/{id}/text-changes", analysisId).param("section", " ").param("q", ""))
                .andExpect(jsonPath("$.section").doesNotExist())
                .andExpect(jsonPath("$.q").doesNotExist())
                .andExpect(jsonPath("$.totalItems").value(6));
    }

    @Test
    @DisplayName("검색어가 2자보다 짧거나 100자보다 길면 400과 errors를 준다")
    void rejectsTooShortOrLongQuery() throws Exception {
        mockMvc.perform(get("/api/analyses/{id}/text-changes", analysisId).param("q", " 가 "))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"))
                .andExpect(jsonPath("$.traceId").exists())
                .andExpect(jsonPath("$.errors[0].field").value("q"));
        mockMvc.perform(get("/api/analyses/{id}/text-changes", analysisId).param("q", "가".repeat(101)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("q"));
        mockMvc.perform(get("/api/analyses/{id}/text-changes", analysisId).param("section", "가".repeat(501)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("section"));
    }
}
