package com.dartinsight.analysis;

import com.dartinsight.analysis.AnalysisResultService.CompletedResult;
import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.comparison.AmountBasis;
import com.dartinsight.comparison.StatementRules;
import com.dartinsight.comparison.StatementRules.StatementRule;
import com.dartinsight.financial.FsDiv;
import com.dartinsight.financial.StatementType;
import com.dartinsight.report.Report;
import com.dartinsight.report.ReportRepository;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 재무 수치 변화 조회 API(docs/api-spec.md). 화면 W-03 ②. 완료된 분석의 결과만 돌려준다.
 */
@RestController
public class FinancialChangeController {

    private final AnalysisResultService resultService;
    private final ReportRepository reportRepository;

    public FinancialChangeController(AnalysisResultService resultService, ReportRepository reportRepository) {
        this.resultService = resultService;
        this.reportRepository = reportRepository;
    }

    @GetMapping("/api/analyses/{analysisId}/financial-changes")
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
}
