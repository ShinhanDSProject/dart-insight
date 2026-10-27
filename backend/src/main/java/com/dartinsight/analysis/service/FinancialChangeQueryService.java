package com.dartinsight.analysis.service;

import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.domain.FinancialChange;
import com.dartinsight.analysis.service.AnalysisResultService.CompletedChange;
import com.dartinsight.analysis.service.AnalysisResultService.CompletedResult;
import com.dartinsight.comparison.domain.StatementRules;
import com.dartinsight.comparison.domain.StatementRules.StatementRule;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.service.ReportService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 재무 수치 변화 조회(W-03 ②)와 수치 근거 상세(3.3). 완료된 분석의 결과를 그 보고서 쌍의 비교 규칙·보고서와 함께 돌려준다. */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class FinancialChangeQueryService {

    private final AnalysisResultService resultService;
    private final ReportService reportService;

    /** 완료된 분석의 계정별 결과와 재무제표별 비교 규칙. 완료되지 않았으면 409 */
    public FinancialChanges changes(Long analysisId) {
        CompletedResult result = resultService.completedResult(analysisId);
        Analysis analysis = result.analysis();
        List<StatementRule> rules = StatementRules.rules(
                reportService.report(analysis.getPreviousRceptNo()).getReportType(),
                reportService.report(analysis.getCurrentRceptNo()).getReportType());
        return new FinancialChanges(analysis, rules, result.changes());
    }

    /** 완료된 분석의 계정 하나와 두 보고서. 다른 분석의 항목이면 404 */
    public FinancialChangeEvidence change(Long analysisId, Long changeId) {
        CompletedChange result = resultService.completedChange(analysisId, changeId);
        Analysis analysis = result.analysis();
        Report previous = reportService.report(analysis.getPreviousRceptNo());
        Report current = reportService.report(analysis.getCurrentRceptNo());
        return new FinancialChangeEvidence(result.change(), previous, current);
    }

    public record FinancialChanges(Analysis analysis, List<StatementRule> rules, List<FinancialChange> changes) {
    }

    public record FinancialChangeEvidence(FinancialChange change, Report previous, Report current) {
    }
}
