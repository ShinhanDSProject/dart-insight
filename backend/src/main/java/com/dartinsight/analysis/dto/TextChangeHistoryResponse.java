package com.dartinsight.analysis.dto;

import com.dartinsight.analysis.service.TextChangeHistoryService.ChangeRef;
import com.dartinsight.analysis.service.TextChangeHistoryService.HistoryEntry;
import com.dartinsight.report.domain.DartLinks;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.domain.ReportType;
import java.time.LocalDate;
import java.util.List;

/** 문장 변경 이력(3.8). 오래된 보고서부터 */
public record TextChangeHistoryResponse(Long analysisId, Long changeId, List<Entry> entries) {

    public static TextChangeHistoryResponse of(Long analysisId, Long changeId, List<HistoryEntry> entries) {
        return new TextChangeHistoryResponse(analysisId, changeId, entries.stream().map(Entry::from).toList());
    }

    public record Entry(ReportRef report, String status, String text, String sectionPath, String evidenceId,
            ChangeView change) {

        static Entry from(HistoryEntry entry) {
            return new Entry(ReportRef.from(entry.report()), entry.status().name(), entry.text(), entry.sectionPath(),
                    entry.evidenceId(), entry.change() == null ? null : ChangeView.from(entry.change()));
        }
    }

    /** dartUrl: 화면의 '출처: DART' 원문 링크(5.6) */
    public record ReportRef(String rceptNo, String reportName, ReportType reportType, LocalDate periodEnd,
            String dartUrl) {

        static ReportRef from(Report report) {
            return new ReportRef(report.getRceptNo(), report.getReportName(), report.getReportType(),
                    report.getPeriodEnd(), DartLinks.viewer(report.getRceptNo()));
        }
    }

    public record ChangeView(long analysisId, long changeId, String changeType) {

        static ChangeView from(ChangeRef ref) {
            return new ChangeView(ref.analysisId(), ref.changeId(), ref.changeType());
        }
    }
}
