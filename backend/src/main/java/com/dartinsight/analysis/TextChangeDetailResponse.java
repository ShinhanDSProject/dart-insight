package com.dartinsight.analysis;

import com.dartinsight.analysis.TextEvidenceService.SourceEvidence;
import com.dartinsight.analysis.TextEvidenceService.TextEvidence;
import com.dartinsight.document.domain.DocumentBlock;
import com.dartinsight.report.ReportType;
import com.fasterxml.jackson.annotation.JsonRawValue;
import java.time.LocalDate;

/** 목록 항목에 두 보고서의 근거를 더한다. 없는 쪽은 null */
public record TextChangeDetailResponse(TextChangeItemResponse change, SourceView previous, SourceView current) {

    static TextChangeDetailResponse from(TextEvidence evidence) {
        return new TextChangeDetailResponse(TextChangeItemResponse.from(evidence.change()),
                SourceView.from(evidence.previous()), SourceView.from(evidence.current()));
    }

    /** 한쪽 보고서의 원문 근거. text는 전체 글, table은 표 셀(문단이면 null) */
    public record SourceView(String rceptNo, String reportName, ReportType reportType, int fiscalYear,
            LocalDate periodEnd, int sectionNo, String sectionPath, Integer blockNo, String evidenceId,
            String blockType, String text, @JsonRawValue String table, boolean blockMatches, String dartUrl) {

        static SourceView from(SourceEvidence evidence) {
            if (evidence == null) {
                return null;
            }
            TextChangeRow.Side side = evidence.side();
            return new SourceView(side.rceptNo(), evidence.report().getReportName(),
                    evidence.report().getReportType(), evidence.report().getFiscalYear(),
                    evidence.report().getPeriodEnd(), side.sectionNo(), evidence.sectionPath(), side.blockNo(),
                    side.blockNo() == null ? null : DocumentBlock.evidenceId(side.rceptNo(), side.blockNo()),
                    evidence.blockType(), side.text(), evidence.tableJson(), evidence.blockMatches(),
                    evidence.dartUrl());
        }
    }
}
