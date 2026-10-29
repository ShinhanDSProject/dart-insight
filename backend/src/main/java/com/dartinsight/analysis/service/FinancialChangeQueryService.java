package com.dartinsight.analysis.service;

import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.domain.ChangeScale;
import com.dartinsight.analysis.domain.ChangeScales;
import com.dartinsight.analysis.domain.FinancialChange;
import com.dartinsight.analysis.domain.FinancialEvidenceMatcher;
import com.dartinsight.analysis.domain.FinancialEvidenceMatcher.RelatedTextChange;
import com.dartinsight.analysis.domain.FinancialEvidenceMatcher.TableLocation;
import com.dartinsight.analysis.domain.TextChange;
import com.dartinsight.analysis.repository.TextChangeStore;
import com.dartinsight.analysis.service.AnalysisResultService.CompletedChange;
import com.dartinsight.analysis.service.AnalysisResultService.CompletedResult;
import com.dartinsight.comparison.domain.StatementRules;
import com.dartinsight.comparison.domain.StatementRules.StatementRule;
import com.dartinsight.document.service.DocumentService;
import com.dartinsight.financial.domain.FsDiv;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.service.ReportService;
import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 재무 수치 변화 조회(W-03 ②)와 수치 근거 상세(3.3, 3.14). 완료된 분석의 결과를 그 보고서 쌍의 비교 규칙·보고서와 함께 돌려준다. */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class FinancialChangeQueryService {

    private final AnalysisResultService resultService;
    private final ReportService reportService;
    private final DocumentService documentService;
    private final TextChangeStore textChangeStore;

    /** 완료된 분석의 계정별 결과와 재무제표별 비교 규칙. 완료되지 않았으면 409 */
    public FinancialChanges changes(Long analysisId) {
        CompletedResult result = resultService.completedResult(analysisId);
        Analysis analysis = result.analysis();
        List<StatementRule> rules = StatementRules.rules(
                reportService.report(analysis.getPreviousRceptNo()).getReportType(),
                reportService.report(analysis.getCurrentRceptNo()).getReportType());
        return new FinancialChanges(analysis, rules, result.changes());
    }

    /** 완료된 분석의 계정 하나, 그 크기 맥락(#480), 두 보고서와 원문 표 위치·관련 변경 문단(#512). 다른 분석의 항목이면 404 */
    public FinancialChangeEvidence change(Long analysisId, Long changeId) {
        CompletedChange result = resultService.completedChange(analysisId, changeId);
        Analysis analysis = result.analysis();
        FinancialChange change = result.change();
        ChangeScale scale = ChangeScales.of(resultService.completedResult(analysisId).changes())
                .scaleOf(change);
        Report previous = reportService.report(analysis.getPreviousRceptNo());
        Report current = reportService.report(analysis.getCurrentRceptNo());

        TableLocation prevTable = tableLocation(change.getPreviousRceptNo(), change.getFsDiv(), change.getSjDiv(),
                change.getAccountName(), analysis.getCompletedAt());
        TableLocation currTable = tableLocation(change.getCurrentRceptNo(), change.getFsDiv(), change.getSjDiv(),
                change.getAccountName(), analysis.getCompletedAt());

        TableLocation baseTable = null;
        if (scale.baseChange() != null) {
            FinancialChange baseChange = scale.baseChange();
            baseTable = tableLocation(baseChange.getCurrentRceptNo(), baseChange.getFsDiv(), baseChange.getSjDiv(),
                    baseChange.getAccountName(), analysis.getCompletedAt());
        }

        List<TextChange> textChanges = textChangeStore.all(analysisId);
        List<RelatedTextChange> related = FinancialEvidenceMatcher.relatedTextChanges(change, textChanges);

        return new FinancialChangeEvidence(change, scale, previous, current, prevTable, currTable, baseTable, related);
    }

    private TableLocation tableLocation(String rceptNo, FsDiv fsDiv, String sjDiv, String accountName,
            LocalDateTime completedAt) {
        if (rceptNo == null) {
            return null;
        }
        return documentService.find(rceptNo)
                .map(doc -> FinancialEvidenceMatcher.findTableLocation(
                        doc,
                        documentService.sections(doc),
                        documentService.blocks(doc),
                        fsDiv,
                        sjDiv,
                        accountName,
                        completedAt))
                .orElse(null);
    }

    /** @param scales 이 분석의 계정 결과로 만든 크기 맥락 계산기(#480) */
    public record FinancialChanges(Analysis analysis, List<StatementRule> rules, List<FinancialChange> changes,
            ChangeScales scales) {

        public FinancialChanges(Analysis analysis, List<StatementRule> rules, List<FinancialChange> changes) {
            this(analysis, rules, changes, ChangeScales.of(changes));
        }
    }

    public record FinancialChangeEvidence(FinancialChange change, ChangeScale scale, Report previous,
            Report current, TableLocation prevTable, TableLocation currTable, TableLocation baseTable,
            List<RelatedTextChange> relatedTextChanges) {
    }
}
