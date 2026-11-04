package com.dartinsight.analysis.controller;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.domain.TextChangeListing.RowDiff;
import com.dartinsight.analysis.domain.TextChangeListing;
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

/** 문장·표 변경 목록의 분류 저장과 묶음·분야 거르기(3.27, ADR-0047) */
@SpringBootTest
@AutoConfigureMockMvc
class TextChangeListingApiTest {

    private static final String CUR = "20260814000001";
    private static final String PREV = "20250814000001";
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 11, 4, 9, 0);
    private static final String BUSINESS = "II. 사업의 내용 > 1. 사업의 개요";
    private static final String LAWSUIT = "XI. 그 밖에 투자자 보호를 위하여 필요한 사항 > 2. 우발부채 등에 관한 사항";
    private static final String NOTES = "III. 재무에 관한 사항 > 3. 연결재무제표 주석";
    private static final String VERSION = "text-list-1";

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
        analysisId = complete(new TextComparison(TextStatus.COMPLETED, null, List.of(
                row(BUSINESS, "새 공장을 지었습니다.", "MAIN", "BUSINESS", false, null, null),
                row(LAWSUIT, "소송 표", "MAIN", "LITIGATION", false, null, rowDiff()),
                row(NOTES, "소송이 제기되었습니다.", "MAIN", "LITIGATION", true, "CONSOLIDATED", null),
                row(BUSINESS, "제목", "HEADING", null, false, null, null),
                row(NOTES, "별도 주석 글", "NOTE", null, false, "SEPARATE", null),
                row(NOTES, "연결 주석 글", "NOTE", null, false, "CONSOLIDATED", null),
                row(NOTES, "구분 없는 주석 글", "NOTE", null, false, "UNKNOWN", null),
                review()), List.of("DIVIDEND", "AUDIT")));
    }

    private Long complete(TextComparison text) {
        Analysis analysis = Analysis.request("00000001", CUR, PREV, ComparisonBasis.YOY, null, NOW);
        analysis.start(NOW);
        Long id = analysisRepository.save(analysis).getId();
        resultService.saveAndComplete(id, List.of(), text);
        return id;
    }

    private static TextChangeRow row(String path, String text, String group, String field, boolean raised,
            String scope, RowDiff rowDiff) {
        return new TextChangeRow(TextChangeRow.ADDED, "PARAGRAPH", false, "MATCHED", path, path, null,
                new Side(CUR, 2, 1, text), null, null, null, null,
                new TextChangeListing(group, field, raised, scope, rowDiff, VERSION));
    }

    private static TextChangeRow review() {
        return new TextChangeRow(TextChangeRow.REVIEW_NEEDED, "SECTION", false, "AMBIGUOUS", BUSINESS, BUSINESS,
                null, new Side(CUR, 1, null, null), null, "짝을 정하지 못했어요.", null, null,
                new TextChangeListing("UNPAIRED", null, false, null, null, VERSION));
    }

    /** 바뀐 행 4개. 목록은 앞의 3개만 준다 */
    private static RowDiff rowDiff() {
        List<RowDiff.ChangedRow> rows = List.of("가", "나", "다", "라").stream()
                .map(key -> new RowDiff.ChangedRow(key, List.of(new RowDiff.Cell("진행상황", "진행 중", "기각"))))
                .toList();
        return new RowDiff("COMPARED", "사건번호", new RowDiff.Counts(4, 1, 1, 2),
                new RowDiff.PairedPrevious(PREV, 40, 512), rows, List.of("새 사건"), List.of("없어진 사건"));
    }

    @Test
    @DisplayName("파라미터가 없으면 접힌 변경까지 모두 주고 분류 값과 분석 전체 건수를 함께 준다")
    void returnsEveryChangeWithClassificationWithoutParameters() throws Exception {
        mockMvc.perform(get("/api/analyses/{id}/text-changes", analysisId).param("sort", "document"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.group").value(nullValue()))
                .andExpect(jsonPath("$.field").value(nullValue()))
                .andExpect(jsonPath("$.totalItems").value(8))
                .andExpect(jsonPath("$.items", hasSize(8)))
                .andExpect(jsonPath("$.listVersion").value(VERSION))
                .andExpect(jsonPath("$.items[0].listGroup").value("MAIN"))
                .andExpect(jsonPath("$.items[0].field").value("BUSINESS"))
                .andExpect(jsonPath("$.items[0].raisedFromNote").value(false))
                .andExpect(jsonPath("$.items[0].noteScope").value(nullValue()))
                .andExpect(jsonPath("$.items[0].rowDiff").value(nullValue()))
                .andExpect(jsonPath("$.items[2].raisedFromNote").value(true))
                .andExpect(jsonPath("$.items[2].noteScope").value("CONSOLIDATED"))
                .andExpect(jsonPath("$.items[3].listGroup").value("HEADING"))
                .andExpect(jsonPath("$.items[3].field").value(nullValue()));
    }

    @Test
    @DisplayName("분야 건수의 합은 기본 목록 건수이고 접는 묶음과 검토 필요는 따로 센다")
    void fieldCountsSumToMainAndOtherGroupsAreSeparate() throws Exception {
        mockMvc.perform(get("/api/analyses/{id}/text-changes", analysisId))
                .andExpect(jsonPath("$.groupCounts.MAIN").value(3))
                .andExpect(jsonPath("$.groupCounts.HEADING").value(1))
                .andExpect(jsonPath("$.groupCounts.FORMATTING").value(0))
                .andExpect(jsonPath("$.groupCounts.MOVED").value(0))
                .andExpect(jsonPath("$.groupCounts.NOTE").value(3))
                .andExpect(jsonPath("$.groupCounts.PAIRED_TABLE").value(0))
                .andExpect(jsonPath("$.groupCounts.UNPAIRED").value(1))
                .andExpect(jsonPath("$.fieldCounts.BUSINESS").value(1))
                .andExpect(jsonPath("$.fieldCounts.LITIGATION").value(2))
                .andExpect(jsonPath("$.fieldCounts.CONTRACT").value(0))
                .andExpect(jsonPath("$.fieldCounts.DIVIDEND").value(0))
                .andExpect(jsonPath("$.fieldCounts.FUNDING").value(0))
                .andExpect(jsonPath("$.fieldCounts.BOARD").value(0))
                .andExpect(jsonPath("$.fieldCounts.SHAREHOLDER").value(0))
                .andExpect(jsonPath("$.fieldCounts.AUDIT").value(0))
                .andExpect(jsonPath("$.fieldCounts.OTHER").value(0));
    }

    @Test
    @DisplayName("변화가 없는 분야와 섹션이 없는 분야를 구분한다")
    void tellsMissingFieldsFromFieldsWithoutChanges() throws Exception {
        mockMvc.perform(get("/api/analyses/{id}/text-changes", analysisId))
                .andExpect(jsonPath("$.missingFields", contains("DIVIDEND", "AUDIT")))
                .andExpect(jsonPath("$.fieldCounts.CONTRACT").value(0))
                .andExpect(jsonPath("$.fieldCounts.DIVIDEND").value(0));
    }

    @Test
    @DisplayName("섹션이 없는 분야가 없으면 빈 배열이다")
    void emptyMissingFieldsStayEmpty() throws Exception {
        Long id = complete(new TextComparison(TextStatus.COMPLETED, null,
                List.of(row(BUSINESS, "글", "MAIN", "BUSINESS", false, null, null)), List.of()));

        mockMvc.perform(get("/api/analyses/{id}/text-changes", id))
                .andExpect(jsonPath("$.listVersion").value(VERSION))
                .andExpect(jsonPath("$.missingFields", hasSize(0)));
    }

    @Test
    @DisplayName("기본 목록을 부르면 접지 않는 묶음만 주고 쪽 나누기도 그 안에서 한다")
    void filtersByGroups() throws Exception {
        mockMvc.perform(get("/api/analyses/{id}/text-changes", analysisId)
                        .param("group", "MAIN,UNPAIRED").param("sort", "document").param("size", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.group").value("MAIN,UNPAIRED"))
                .andExpect(jsonPath("$.totalItems").value(4))
                .andExpect(jsonPath("$.items", hasSize(2)))
                // 유형·섹션 건수는 묶음을 보지 않는다
                .andExpect(jsonPath("$.counts.all").value(8))
                .andExpect(jsonPath("$.groupCounts.NOTE").value(3));
    }

    @Test
    @DisplayName("분야로 거르면 그 분야의 변경만 주고 분야가 없는 짝 없음 항목은 빠진다")
    void filtersByField() throws Exception {
        mockMvc.perform(get("/api/analyses/{id}/text-changes", analysisId)
                        .param("group", "MAIN,UNPAIRED").param("field", "LITIGATION").param("sort", "document"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.field").value("LITIGATION"))
                .andExpect(jsonPath("$.totalItems").value(2))
                .andExpect(jsonPath("$.items[*].field", contains("LITIGATION", "LITIGATION")))
                // 분야 건수는 거르기와 상관없이 분석 전체를 센다
                .andExpect(jsonPath("$.fieldCounts.BUSINESS").value(1));
    }

    @Test
    @DisplayName("검색어로는 접힌 변경도 찾는다")
    void searchFindsFoldedChanges() throws Exception {
        mockMvc.perform(get("/api/analyses/{id}/text-changes", analysisId).param("q", "별도 주석"))
                .andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items[0].listGroup").value("NOTE"));
    }

    @Test
    @DisplayName("주석 묶음 하나만 고르면 연결, 별도, 구분 없음 순서로 준다")
    void noteGroupIsOrderedByScope() throws Exception {
        mockMvc.perform(get("/api/analyses/{id}/text-changes", analysisId).param("group", "NOTE"))
                .andExpect(jsonPath("$.items[*].noteScope", contains("CONSOLIDATED", "SEPARATE", "UNKNOWN")));
    }

    @Test
    @DisplayName("목록은 바뀐 행을 3개까지만 주고 상세는 전부와 새 행·없는 행을 준다")
    void listCutsChangedRowsAndDetailGivesAll() throws Exception {
        Long changeId = jdbcTemplate.queryForObject(
                "SELECT id FROM text_change WHERE analysis_id = ? AND change_no = 2", Long.class, analysisId);

        mockMvc.perform(get("/api/analyses/{id}/text-changes", analysisId).param("sort", "document"))
                .andExpect(jsonPath("$.items[1].rowDiff.status").value("COMPARED"))
                .andExpect(jsonPath("$.items[1].rowDiff.keyColumn").value("사건번호"))
                .andExpect(jsonPath("$.items[1].rowDiff.counts.changed").value(4))
                .andExpect(jsonPath("$.items[1].rowDiff.pairedPrevious.rceptNo").value(PREV))
                .andExpect(jsonPath("$.items[1].rowDiff.pairedPrevious.blockNo").value(512))
                .andExpect(jsonPath("$.items[1].rowDiff.changedRows", hasSize(3)))
                .andExpect(jsonPath("$.items[1].rowDiff.changedRows[0].cells[0].current").value("기각"))
                .andExpect(jsonPath("$.items[1].rowDiff.addedKeys").doesNotExist())
                .andExpect(jsonPath("$.items[1].rowDiff.missingKeys").doesNotExist());

        mockMvc.perform(get("/api/analyses/{a}/text-changes/{c}", analysisId, changeId))
                .andExpect(jsonPath("$.change.rowDiff.changedRows", hasSize(4)))
                .andExpect(jsonPath("$.change.rowDiff.addedKeys", contains("새 사건")))
                .andExpect(jsonPath("$.change.rowDiff.missingKeys", contains("없어진 사건")));
    }

    @Test
    @DisplayName("옛 분석은 묶음·분야를 무시하고 저장된 변경을 그대로 준다")
    void oldAnalysisIgnoresListingParameters() throws Exception {
        Long old = complete(new TextComparison(TextStatus.COMPLETED, null, List.of(
                new TextChangeRow(TextChangeRow.ADDED, "PARAGRAPH", false, "MATCHED", BUSINESS, BUSINESS, null,
                        new Side(CUR, 2, 1, "옛 분석의 글"), null, null))));
        jdbcTemplate.update("UPDATE analysis SET analysis_version = 'm2-17' WHERE id = ?", old);

        mockMvc.perform(get("/api/analyses/{id}/text-changes", old)
                        .param("group", "MAIN").param("field", "LITIGATION"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.group").value(nullValue()))
                .andExpect(jsonPath("$.field").value(nullValue()))
                .andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.listVersion").value(nullValue()))
                .andExpect(jsonPath("$.fieldCounts").value(nullValue()))
                .andExpect(jsonPath("$.missingFields").value(nullValue()))
                .andExpect(jsonPath("$.groupCounts").value(nullValue()))
                .andExpect(jsonPath("$.items[0].listGroup").value(nullValue()))
                .andExpect(jsonPath("$.items[0].field").value(nullValue()))
                .andExpect(jsonPath("$.items[0].raisedFromNote").value(nullValue()))
                .andExpect(jsonPath("$.items[0].noteScope").value(nullValue()))
                .andExpect(jsonPath("$.items[0].rowDiff").value(nullValue()));
        mockMvc.perform(get("/api/analyses/{id}", old))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.outdated").value(true));
    }

    @Test
    @DisplayName("알 수 없는 묶음·분야는 400이다")
    void rejectsUnknownGroupAndField() throws Exception {
        for (String group : List.of("WRONG", "MAIN,")) {
            mockMvc.perform(get("/api/analyses/{id}/text-changes", analysisId).param("group", group))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"))
                    .andExpect(jsonPath("$.errors[0].field").value("group"));
        }
        mockMvc.perform(get("/api/analyses/{id}/text-changes", analysisId).param("field", "LITIGATION,BOARD"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("field"));
    }
}
