package com.dartinsight.analysis;

import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dartinsight.analysis.FinancialChangeRow.Evidence;
import com.dartinsight.company.service.CompanyImportService;
import com.dartinsight.comparison.domain.AmountBasis;
import com.dartinsight.comparison.domain.ComparisonBasis;
import com.dartinsight.dart.dto.CorpCodeEntry;
import com.dartinsight.financial.domain.FsDiv;
import com.dartinsight.report.domain.Correction;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.service.ReportNameParser.ParsedReportName;
import com.dartinsight.report.repository.ReportRepository;
import com.dartinsight.report.domain.ReportType;
import com.dartinsight.support.TestData;
import java.math.BigDecimal;
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
class FinancialChangeDetailTest {

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
    private FinancialChangeRepository changeRepository;

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
        analysis.recordFsDiv(FsDiv.CFS);
        analysisId = analysisRepository.save(analysis).getId();
        resultService.saveAndComplete(analysisId, List.of(
                new FinancialChangeRow("IS", FsDiv.CFS, "ifrs-full_Revenue", "매출액", 0, AmountBasis.CUMULATIVE,
                        145_000_000_000_000L, 152_000_000_000_000L, 7_000_000_000_000L, new BigDecimal("0.048276"),
                        CalcStatus.OK, "KRW",
                        new Evidence(PREV, "IS", "ifrs-full_Revenue", "매출액", "제 56 기 반기"),
                        new Evidence(CUR, "IS", "ifrs-full_Revenue", "매출액", "제 57 기 반기")),
                // 실제 비율 1.23495% → 저장값 0.012350. 저장값을 다시 반올림하면 1.24%가 된다
                new FinancialChangeRow("IS", FsDiv.CFS, "ifrs-full_CostOfSales", "매출원가", 1,
                        AmountBasis.CUMULATIVE, 10_000_000L, 10_123_495L, 123_495L, new BigDecimal("0.012350"),
                        CalcStatus.OK, "KRW",
                        new Evidence(PREV, "IS", "ifrs-full_CostOfSales", "매출원가", "제 56 기 반기"),
                        new Evidence(CUR, "IS", "ifrs-full_CostOfSales", "매출원가", "제 57 기 반기")),
                new FinancialChangeRow("BS", FsDiv.CFS, "NAME:신규계정", "신규계정", 0, AmountBasis.POINT,
                        null, 50L, null, null, CalcStatus.ONLY_CURRENT, "KRW", null,
                        new Evidence(CUR, "BS", "-표준계정코드 미사용-", "신규계정", "제 57 기 반기"))));
    }

    private Long changeId(String accountName) {
        return changeRepository.findByAnalysisIdOrderBySjDivAscDisplayOrderAsc(analysisId).stream()
                .filter(c -> c.getAccountName().equals(accountName)).findFirst().orElseThrow().getId();
    }

    @Test
    void showsValuesFormulaAndSources() throws Exception {
        mockMvc.perform(get("/api/analyses/{a}/financial-changes/{c}", analysisId, changeId("매출액")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accountName").value("매출액"))
                .andExpect(jsonPath("$.accountKey").value("ifrs-full_Revenue"))
                .andExpect(jsonPath("$.fsDiv").value("CFS"))
                .andExpect(jsonPath("$.amountBasis").value("CUMULATIVE"))
                .andExpect(jsonPath("$.currency").value("KRW"))
                .andExpect(jsonPath("$.previousAmount").value(145_000_000_000_000L))
                .andExpect(jsonPath("$.direction").value("UP"))
                .andExpect(jsonPath("$.formula")
                        .value("152,000,000,000,000 − 145,000,000,000,000 = 7,000,000,000,000"))
                .andExpect(jsonPath("$.rateFormula")
                        .value("7,000,000,000,000 ÷ 145,000,000,000,000 × 100 = 4.83%"))
                .andExpect(jsonPath("$.previous.rceptNo").value(PREV))
                .andExpect(jsonPath("$.previous.reportName").value("반기보고서 (2025.06)"))
                .andExpect(jsonPath("$.previous.periodEnd").value("2025-06-30"))
                .andExpect(jsonPath("$.previous.periodName").value("제 56 기 반기"))
                .andExpect(jsonPath("$.previous.sjDiv").value("IS"))
                .andExpect(jsonPath("$.previous.accountId").value("ifrs-full_Revenue"))
                .andExpect(jsonPath("$.previous.dartUrl")
                        .value("https://dart.fss.or.kr/dsaf001/main.do?rcpNo=" + PREV))
                .andExpect(jsonPath("$.current.rceptNo").value(CUR));
    }

    @Test
    void rateFormulaIsComputedFromTheAmountsItShows() throws Exception {
        mockMvc.perform(get("/api/analyses/{a}/financial-changes/{c}", analysisId, changeId("매출원가")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rateFormula").value("123,495 ÷ 10,000,000 × 100 = 1.23%"));
    }

    @Test
    void uncalculatedValueHasReasonInsteadOfNumbers() throws Exception {
        mockMvc.perform(get("/api/analyses/{a}/financial-changes/{c}", analysisId, changeId("신규계정")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.calcStatus").value("ONLY_CURRENT"))
                .andExpect(jsonPath("$.calcMessage").isNotEmpty())
                .andExpect(jsonPath("$.previousAmount").value(nullValue()))
                .andExpect(jsonPath("$.changeAmount").value(nullValue()))
                .andExpect(jsonPath("$.formula").value(nullValue()))
                .andExpect(jsonPath("$.rateFormula").value(nullValue()))
                .andExpect(jsonPath("$.previous").value(nullValue()))
                .andExpect(jsonPath("$.current.accountId").value("-표준계정코드 미사용-"));
    }

    @Test
    void changeOfAnotherAnalysisIsNotFound() throws Exception {
        Analysis other = Analysis.request("00000001", CUR, PREV, ComparisonBasis.CUSTOM, null, NOW);
        other.start(NOW);
        other.recordFsDiv(FsDiv.CFS);
        Long otherId = analysisRepository.save(other).getId();
        resultService.saveAndComplete(otherId, List.of(new FinancialChangeRow("BS", FsDiv.CFS, "k", "자산총계", 0,
                AmountBasis.POINT, 1L, 2L, 1L, null, CalcStatus.OK, "KRW",
                new Evidence(PREV, "BS", "k", "자산총계", null), new Evidence(CUR, "BS", "k", "자산총계", null))));

        mockMvc.perform(get("/api/analyses/{a}/financial-changes/{c}", analysisId, 999_999))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ANALYSIS_CHANGE_NOT_FOUND"));
        mockMvc.perform(get("/api/analyses/{a}/financial-changes/{c}", otherId, changeId("매출액")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ANALYSIS_CHANGE_NOT_FOUND"));
    }

    @Test
    void unfinishedAnalysisIsNotReady() throws Exception {
        Long pendingId = analysisRepository.save(
                Analysis.request("00000001", CUR, PREV, ComparisonBasis.PREV, null, NOW)).getId();

        mockMvc.perform(get("/api/analyses/{a}/financial-changes/{c}", pendingId, changeId("매출액")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ANALYSIS_NOT_READY"));
    }
}
