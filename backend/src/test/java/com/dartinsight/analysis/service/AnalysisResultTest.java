package com.dartinsight.analysis.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.domain.AnalysisStatus;
import com.dartinsight.analysis.domain.AnalysisStep;
import com.dartinsight.analysis.domain.CalcStatus;
import com.dartinsight.analysis.domain.FinancialChangeRow.Evidence;
import com.dartinsight.analysis.domain.FinancialChangeRow;
import com.dartinsight.analysis.domain.TextComparison;
import com.dartinsight.analysis.domain.TextStatus;
import com.dartinsight.analysis.repository.AnalysisRepository;
import com.dartinsight.analysis.repository.FinancialChangeRepository;
import com.dartinsight.company.service.CompanyImportService;
import com.dartinsight.comparison.domain.AmountBasis;
import com.dartinsight.comparison.domain.ComparisonBasis;
import com.dartinsight.dart.domain.CorpCodeEntry;
import com.dartinsight.financial.domain.FsDiv;
import com.dartinsight.report.domain.Correction;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.domain.ReportNameParser.ParsedReportName;
import com.dartinsight.report.repository.ReportRepository;
import com.dartinsight.report.domain.ReportType;
import com.dartinsight.support.TestData;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class AnalysisResultTest {

    private static final String CUR = "20260814000001";
    private static final String PREV = "20250814000001";
    private static final String CORRECTED_PREV = "20250901000001";
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 21, 9, 0);

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AnalysisResultService resultService;

    @Autowired
    private AnalysisRepository analysisRepository;

    @Autowired
    private FinancialChangeRepository changeRepository;

    @Autowired
    private CompanyImportService companyImportService;

    @Autowired
    private ReportRepository reportRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private Clock clock;

    @BeforeEach
    void setUp() {
        TestData.clearAll(jdbcTemplate);
        companyImportService.save(List.of(
                new CorpCodeEntry("00000001", "예시전자", null, "900001", LocalDate.of(2026, 1, 1))));
        saveReport(CUR, 2026);
        saveReport(PREV, 2025);
        saveReport(CORRECTED_PREV, 2025);
    }

    private void saveReport(String rceptNo, int year) {
        reportRepository.save(Report.create(rceptNo, "00000001", "반기보고서 (" + year + ".06)",
                new ParsedReportName(ReportType.HALF, year, LocalDate.of(year, 6, 30), Correction.ORIGINAL),
                LocalDate.of(year, 8, 14), null, "예시전자", NOW));
    }

    /** 진행 중인 분석. 멈춘 것으로 보지 않도록 지금 시각(서버 시계)으로 만든다 */
    private Analysis running(String previous) {
        LocalDateTime now = LocalDateTime.now(clock);
        Analysis analysis = Analysis.request("00000001", CUR, previous, ComparisonBasis.YOY, "trace-1", now);
        analysis.start(now);
        analysis.recordFsDiv(FsDiv.CFS);
        return analysisRepository.save(analysis);
    }

    private static FinancialChangeRow row(String sjDiv, String key, String name, int order, Long prev, Long cur,
            CalcStatus status) {
        Long change = prev == null || cur == null ? null : cur - prev;
        BigDecimal rate = status == CalcStatus.OK
                ? BigDecimal.valueOf(change).divide(BigDecimal.valueOf(prev), 6, RoundingMode.HALF_UP) : null;
        return new FinancialChangeRow(sjDiv, FsDiv.CFS, key, name, order,
                sjDiv.equals("BS") ? AmountBasis.POINT : AmountBasis.CUMULATIVE, prev, cur, change, rate, status, "KRW",
                prev == null ? null : new Evidence(PREV, sjDiv, key, name, "제 9 기 반기"),
                cur == null ? null : new Evidence(CUR, sjDiv, key, name, "제 10 기 반기"));
    }

    private static List<FinancialChangeRow> sampleRows() {
        return List.of(
                row("BS", "ifrs-full_Assets", "자산총계", 0, 1_000L, 1_153L, CalcStatus.OK),
                row("BS", "ifrs-full_Cash", "현금및현금성자산", 1, 200L, 200L, CalcStatus.OK),
                row("BS", "NAME:기타금융자산", "기타금융자산", 2, null, 50L, CalcStatus.ONLY_CURRENT),
                row("IS", "ifrs-full_Revenue", "매출액", 0, 0L, 70L, CalcStatus.PREVIOUS_ZERO));
    }

    @Test
    void savesResultsAndCompletesTogether() throws Exception {
        Analysis analysis = running(PREV);

        resultService.saveAndComplete(analysis.getId(), sampleRows());

        Analysis saved = analysisRepository.findById(analysis.getId()).orElseThrow();
        assertThat(saved.getStatus()).isEqualTo(AnalysisStatus.COMPLETED);
        assertThat(saved.getStep()).isEqualTo(AnalysisStep.DONE);
        assertThat(saved.getCompletedAt()).isNotNull();
        mockMvc.perform(get("/api/analyses/{id}/financial-changes", analysis.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.analysisId").value(analysis.getId()))
                .andExpect(jsonPath("$.fsDiv").value("CFS"))
                .andExpect(jsonPath("$.sjDiv").value("BS"))
                .andExpect(jsonPath("$.statements", hasSize(5)))
                .andExpect(jsonPath("$.statements[0].sjDiv").value("BS"))
                .andExpect(jsonPath("$.statements[0].total").value(3))
                .andExpect(jsonPath("$.statements[0].changed").value(2))
                .andExpect(jsonPath("$.statements[0].amountBasis").value("POINT"))
                .andExpect(jsonPath("$.statements[1].sjDiv").value("IS"))
                .andExpect(jsonPath("$.statements[1].total").value(1))
                .andExpect(jsonPath("$.items", hasSize(3)))
                .andExpect(jsonPath("$.items[0].changeId").isNumber())
                .andExpect(jsonPath("$.items[0].accountName").value("자산총계"))
                .andExpect(jsonPath("$.items[0].previousAmount").value(1000))
                .andExpect(jsonPath("$.items[0].currentAmount").value(1153))
                .andExpect(jsonPath("$.items[0].changeAmount").value(153))
                .andExpect(jsonPath("$.items[0].changeRate").value(0.153))
                .andExpect(jsonPath("$.items[0].direction").value("UP"))
                .andExpect(jsonPath("$.items[0].calcStatus").value("OK"))
                .andExpect(jsonPath("$.items[0].calcMessage").value(nullValue()))
                .andExpect(jsonPath("$.items[0].currency").value("KRW"))
                .andExpect(jsonPath("$.items[2].calcStatus").value("ONLY_CURRENT"))
                .andExpect(jsonPath("$.items[2].previousAmount").value(nullValue()))
                .andExpect(jsonPath("$.items[2].calcMessage").isNotEmpty());
        mockMvc.perform(get("/api/analyses/{id}/financial-changes", analysis.getId()).param("sjDiv", "IS"))
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].calcStatus").value("PREVIOUS_ZERO"))
                .andExpect(jsonPath("$.items[0].changeRate").value(nullValue()));
    }

    @Test
    void changedOnlyHidesUnchangedAccounts() throws Exception {
        Analysis analysis = running(PREV);
        resultService.saveAndComplete(analysis.getId(), sampleRows());

        mockMvc.perform(get("/api/analyses/{id}/financial-changes", analysis.getId()).param("changedOnly", "true"))
                .andExpect(jsonPath("$.changedOnly").value(true))
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.items[0].accountName").value("자산총계"))
                .andExpect(jsonPath("$.items[1].accountName").value("기타금융자산"));
    }

    @Test
    void resultsOfAnotherAnalysisAreNotMixed() throws Exception {
        Analysis first = running(PREV);
        resultService.saveAndComplete(first.getId(), sampleRows());
        Analysis second = running(CORRECTED_PREV);
        resultService.saveAndComplete(second.getId(),
                List.of(row("BS", "ifrs-full_Assets", "자산총계", 0, 900L, 1_153L, CalcStatus.OK)));

        mockMvc.perform(get("/api/analyses/{id}/financial-changes", second.getId()))
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].previousAmount").value(900));
    }

    @Test
    void failedSaveDoesNotComplete() {
        Analysis analysis = running(PREV);
        FinancialChangeRow broken = row("BS", "k", null, 0, 1L, 2L, CalcStatus.OK);

        assertThatThrownBy(() -> resultService.saveAndComplete(analysis.getId(),
                List.of(row("BS", "a", "A", 0, 1L, 2L, CalcStatus.OK), broken)))
                .isInstanceOf(RuntimeException.class);

        assertThat(analysisRepository.findById(analysis.getId()).orElseThrow().getStatus())
                .isEqualTo(AnalysisStatus.RUNNING);
        assertThat(changeRepository.findByAnalysisIdOrderBySjDivAscDisplayOrderAsc(analysis.getId())).isEmpty();
    }

    @Test
    void unfinishedUnknownAndInvalidRequests() throws Exception {
        Analysis analysis = running(PREV);

        mockMvc.perform(get("/api/analyses/{id}/financial-changes", analysis.getId()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ANALYSIS_NOT_READY"));
        mockMvc.perform(get("/api/analyses/{id}/financial-changes", 999_999))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ANALYSIS_NOT_FOUND"));
        mockMvc.perform(get("/api/analyses/{id}/financial-changes", analysis.getId()).param("sjDiv", "XX"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("sjDiv"));
    }

    @Test
    void stuckAnalysisIsExpiredInsteadOfReused() {
        Analysis stuck = running(PREV);
        jdbcTemplate.update("UPDATE analysis SET updated_at = ? WHERE id = ?", LocalDateTime.of(2000, 1, 1, 0, 0),
                stuck.getId());

        assertThat(resultService.findReusable("00000001", CUR, PREV, ComparisonBasis.YOY)).isEmpty();

        Analysis expired = analysisRepository.findById(stuck.getId()).orElseThrow();
        assertThat(expired.getStatus()).isEqualTo(AnalysisStatus.FAILED);
        assertThat(expired.getErrorCode()).isEqualTo("ANALYSIS_TIMED_OUT");
    }

    @Test
    void reusePolicy() {
        assertThat(resultService.findReusable("00000001", CUR, PREV, ComparisonBasis.YOY)).isEmpty();

        Analysis failed = running(PREV);
        failed.fail("DART_RATE_LIMITED", "한도 초과", NOW);
        analysisRepository.save(failed);
        assertThat(resultService.findReusable("00000001", CUR, PREV, ComparisonBasis.YOY))
                .as("실패한 분석은 다시 쓰지 않는다").isEmpty();

        Analysis inProgress = running(PREV);
        assertThat(resultService.findReusable("00000001", CUR, PREV, ComparisonBasis.YOY)).get()
                .extracting(Analysis::getId).isEqualTo(inProgress.getId());

        resultService.saveAndComplete(inProgress.getId(), sampleRows(),
                new TextComparison(TextStatus.COMPLETED, null, List.of()));
        running(PREV);
        assertThat(resultService.findReusable("00000001", CUR, PREV, ComparisonBasis.YOY)).get()
                .as("완료된 결과가 있으면 그것을 쓴다").extracting(Analysis::getId).isEqualTo(inProgress.getId());

        assertThat(resultService.findReusable("00000001", CUR, CORRECTED_PREV, ComparisonBasis.YOY))
                .as("정정 공시(다른 접수번호)는 다른 분석").isEmpty();
        assertThat(resultService.findReusable("00000001", CUR, PREV, ComparisonBasis.CUSTOM))
                .as("비교 기준이 다르면 다른 분석").isEmpty();

        jdbcTemplate.update("UPDATE analysis SET analysis_version = 'old'");
        assertThat(resultService.findReusable("00000001", CUR, PREV, ComparisonBasis.YOY))
                .as("분석 버전이 다르면 섞지 않는다").isEmpty();
    }
}
