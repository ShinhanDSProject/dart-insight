package com.dartinsight.analysis;

import com.dartinsight.analysis.AnalysisResultService.CompletedChange;
import com.dartinsight.analysis.AnalysisResultService.CompletedResult;
import com.dartinsight.analysis.FinancialChangeListResponse.FinancialChangeItem;
import com.dartinsight.analysis.FinancialChangeListResponse.StatementSummary;
import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.web.ApiPaths;
import com.dartinsight.comparison.StatementRules;
import com.dartinsight.comparison.StatementRules.StatementRule;
import com.dartinsight.financial.StatementType;
import com.dartinsight.report.Report;
import com.dartinsight.report.ReportService;
import java.util.List;
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
    private final ReportService reportService;

    public FinancialChangeController(AnalysisResultService resultService, ReportService reportService) {
        this.resultService = resultService;
        this.reportService = reportService;
    }

    @GetMapping
    public FinancialChangeListResponse list(@PathVariable Long analysisId,
            @RequestParam(defaultValue = "BS") String sjDiv,
            @RequestParam(defaultValue = "false") boolean changedOnly) {
        StatementType selected = StatementType.of(sjDiv)
                .orElseThrow(() -> ApiException.invalidInput("sjDiv", "BS, IS, CIS, CF, SCE 중 하나여야 합니다."));
        CompletedResult result = resultService.completedResult(analysisId);
        Analysis analysis = result.analysis();
        List<StatementRule> rules = StatementRules.rules(
                reportService.report(analysis.getPreviousRceptNo()).getReportType(),
                reportService.report(analysis.getCurrentRceptNo()).getReportType());

        List<StatementSummary> statements = rules.stream()
                .map(rule -> StatementSummary.of(rule, result.changes())).toList();
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
        Report previous = reportService.report(analysis.getPreviousRceptNo());
        Report current = reportService.report(analysis.getCurrentRceptNo());
        return FinancialChangeDetailResponse.of(result.change(), previous, current);
    }
}
