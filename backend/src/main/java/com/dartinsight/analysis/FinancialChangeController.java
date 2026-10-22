package com.dartinsight.analysis;

import com.dartinsight.analysis.AnalysisResultService.CompletedChange;
import com.dartinsight.analysis.AnalysisResultService.CompletedResult;
import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.common.web.ApiPaths;
import com.dartinsight.comparison.AmountBasis;
import com.dartinsight.comparison.StatementRules;
import com.dartinsight.comparison.StatementRules.StatementRule;
import com.dartinsight.financial.FsDiv;
import com.dartinsight.financial.StatementType;
import com.dartinsight.report.DartLinks;
import com.dartinsight.report.Report;
import com.dartinsight.report.ReportRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 재무 수치 변화 조회 API(docs/api-spec.md). 화면 W-03 ②와 수치 근거 상세(3.3). 완료된 분석의 결과만 돌려준다.
 */
@RestController
@RequestMapping(ApiPaths.ANALYSIS_FINANCIAL_CHANGES)
public class FinancialChangeController {

    private final AnalysisResultService resultService;
    private final ReportRepository reportRepository;

    public FinancialChangeController(AnalysisResultService resultService, ReportRepository reportRepository) {
        this.resultService = resultService;
        this.reportRepository = reportRepository;
    }

    @GetMapping
    public FinancialChangeListResponse list(@PathVariable Long analysisId,
            @RequestParam(defaultValue = "BS") String sjDiv,
            @RequestParam(defaultValue = "false") boolean changedOnly) {
        StatementType selected = StatementType.of(sjDiv)
                .orElseThrow(() -> ApiException.invalidInput("sjDiv", "BS, IS, CIS, CF, SCE 중 하나여야 합니다."));
        CompletedResult result = resultService.completedResult(analysisId);
        Analysis analysis = result.analysis();
        List<StatementRule> rules = StatementRules.rules(report(analysis.getPreviousRceptNo()).getReportType(),
                report(analysis.getCurrentRceptNo()).getReportType());

        List<StatementSummary> statements = rules.stream().map(rule -> {
            List<FinancialChange> rows = result.changes().stream()
                    .filter(c -> c.getSjDiv().equals(rule.type().name())).toList();
            return new StatementSummary(rule.type().name(), rule.type().label(), rule.comparable(),
                    rule.amountBasis(), rule.note(), rows.size(),
                    (int) rows.stream().filter(FinancialChange::changedOrUncalculated).count());
        }).toList();
        List<FinancialChangeItem> items = result.changes().stream()
                .filter(c -> c.getSjDiv().equals(selected.name()))
                .filter(c -> !changedOnly || c.changedOrUncalculated())
                .map(FinancialChangeItem::from)
                .toList();
        return new FinancialChangeListResponse(analysisId, analysis.getFsDiv(), selected.name(), changedOnly,
                statements, items);
    }

    @GetMapping(ApiPaths.BY_CHANGE_ID)
    public FinancialChangeDetailResponse detail(@PathVariable Long analysisId, @PathVariable Long changeId) {
        CompletedChange result = resultService.completedChange(analysisId, changeId);
        Analysis analysis = result.analysis();
        FinancialChange c = result.change();
        Report previous = report(analysis.getPreviousRceptNo());
        Report current = report(analysis.getCurrentRceptNo());
        return new FinancialChangeDetailResponse(c.getId(), c.getSjDiv(), c.getAccountName(), c.getAccountKey(),
                c.getFsDiv(), c.getAmountBasis(), c.getPreviousAmount(), c.getCurrentAmount(), c.getChangeAmount(),
                c.getChangeRate(), c.direction(), c.getCalcStatus(), c.getCalcStatus().message(), c.getCurrency(),
                formula(c), rateFormula(c),
                c.getPreviousRceptNo() == null ? null : Source.of(previous, c.getSjDiv(), c.getPreviousAccountId(),
                        c.getPreviousPeriodName()),
                c.getCurrentRceptNo() == null ? null : Source.of(current, c.getSjDiv(), c.getCurrentAccountId(),
                        c.getCurrentPeriodName()));
    }

    /** 증감액 계산식(원 단위). 계산하지 않았으면 null */
    static String formula(FinancialChange c) {
        if (c.getChangeAmount() == null) {
            return null;
        }
        return won(c.getCurrentAmount()) + " − " + won(c.getPreviousAmount()) + " = " + won(c.getChangeAmount());
    }

    /**
     * 증감률 계산식. 계산하지 않았으면 null.
     * 저장된 증감률(소수 6자리)을 다시 반올림하면 식의 숫자와 어긋날 수 있어, 식에 적는 두 금액으로 바로 계산한다.
     */
    static String rateFormula(FinancialChange c) {
        if (c.getChangeRate() == null) {
            return null;
        }
        BigDecimal percent = BigDecimal.valueOf(c.getChangeAmount()).movePointRight(2)
                .divide(BigDecimal.valueOf(c.getPreviousAmount()), 2, RoundingMode.HALF_UP);
        return won(c.getChangeAmount()) + " ÷ " + won(c.getPreviousAmount()) + " × 100 = " + percent.toPlainString()
                + "%";
    }

    private static String won(Long amount) {
        // 서버 지역 설정과 관계없이 쉼표로 끊는다
        return new DecimalFormat("#,##0", DecimalFormatSymbols.getInstance(Locale.ROOT)).format(amount)
                .replace("-", "−");
    }

    private Report report(String rceptNo) {
        return reportRepository.findById(rceptNo).orElseThrow(() -> new ApiException(ErrorCode.REPORT_NOT_FOUND));
    }

    public record FinancialChangeListResponse(Long analysisId, FsDiv fsDiv, String sjDiv, boolean changedOnly,
            List<StatementSummary> statements, List<FinancialChangeItem> items) {
    }

    /**
     * @param total   계정 수
     * @param changed 값이 바뀌었거나 계산하지 못한 계정 수
     */
    public record StatementSummary(String sjDiv, String label, boolean comparable, AmountBasis amountBasis,
            String note, int total, int changed) {
    }

    public record FinancialChangeItem(
            Long changeId,
            String sjDiv,
            String accountName,
            AmountBasis amountBasis,
            Long previousAmount,
            Long currentAmount,
            Long changeAmount,
            BigDecimal changeRate,
            String direction,
            CalcStatus calcStatus,
            String calcMessage,
            String currency) {

        static FinancialChangeItem from(FinancialChange c) {
            return new FinancialChangeItem(c.getId(), c.getSjDiv(), c.getAccountName(), c.getAmountBasis(),
                    c.getPreviousAmount(), c.getCurrentAmount(), c.getChangeAmount(), c.getChangeRate(),
                    c.direction(), c.getCalcStatus(), c.getCalcStatus().message(), c.getCurrency());
        }
    }

    /**
     * @param formula     증감액 계산식(원 단위). 계산하지 않았으면 null
     * @param rateFormula 증감률 계산식. 계산하지 않았으면 null
     * @param previous    이전 값의 근거. 이전 보고서에 없는 계정이면 null
     * @param current     현재 값의 근거. 현재 보고서에 없는 계정이면 null
     */
    public record FinancialChangeDetailResponse(
            Long changeId,
            String sjDiv,
            String accountName,
            String accountKey,
            FsDiv fsDiv,
            AmountBasis amountBasis,
            Long previousAmount,
            Long currentAmount,
            Long changeAmount,
            BigDecimal changeRate,
            String direction,
            CalcStatus calcStatus,
            String calcMessage,
            String currency,
            String formula,
            String rateFormula,
            Source previous,
            Source current) {
    }

    /**
     * 수치의 원천: 보고서와 재무제표 안의 계정.
     *
     * @param periodName 재무제표 API의 당기 이름(예: 제 57 기 반기)
     */
    public record Source(String rceptNo, String reportName, int fiscalYear, LocalDate periodEnd, String periodName,
            String sjDiv, String accountId, String dartUrl) {

        static Source of(Report report, String sjDiv, String accountId, String periodName) {
            return new Source(report.getRceptNo(), report.getReportName(), report.getFiscalYear(),
                    report.getPeriodEnd(), periodName, sjDiv, accountId, DartLinks.viewer(report.getRceptNo()));
        }
    }
}
