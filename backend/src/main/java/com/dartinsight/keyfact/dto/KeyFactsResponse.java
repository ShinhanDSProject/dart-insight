package com.dartinsight.keyfact.dto;

import com.dartinsight.comparison.service.ReportPairService.ReportPair;
import com.dartinsight.keyfact.domain.Dividend;
import com.dartinsight.keyfact.domain.Executive;
import com.dartinsight.keyfact.domain.KeyFactChange;
import com.dartinsight.keyfact.domain.KeyFactSection;
import com.dartinsight.keyfact.domain.MajorShareholder;
import com.dartinsight.keyfact.service.KeyFactService.Group;
import com.dartinsight.keyfact.service.KeyFactService.KeyFacts;
import com.dartinsight.report.domain.DartLinks;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.domain.ReportType;
import java.time.LocalDate;
import java.util.List;

/** 최대주주·임원·배당 변화(docs/api-spec.md GET /api/companies/{corpCode}/key-facts). */
public record KeyFactsResponse(
        String corpCode,
        ReportSource current,
        ReportSource previous,
        Reason previousReason,
        GroupResponse<MajorShareholder> majorShareholders,
        GroupResponse<Executive> executives,
        GroupResponse<Dividend> dividends) {

    public static KeyFactsResponse from(KeyFacts facts) {
        ReportPair pair = facts.pair();
        Reason reason = pair.reason() == null ? null
                : new Reason(pair.reason().name(), pair.reason().message());
        return new KeyFactsResponse(facts.corpCode(), ReportSource.from(pair.current()),
                ReportSource.from(pair.previous()), reason, GroupResponse.from(facts.majorShareholders()),
                GroupResponse.from(facts.executives()), GroupResponse.from(facts.dividends()));
    }

    /** 묶음의 출처 보고서 */
    public record ReportSource(String rceptNo, String reportName, ReportType reportType, int fiscalYear,
            LocalDate periodEnd, String dartUrl) {

        static ReportSource from(Report report) {
            return report == null ? null : new ReportSource(report.getRceptNo(), report.getReportName(),
                    report.getReportType(), report.getFiscalYear(), report.getPeriodEnd(),
                    DartLinks.viewer(report.getRceptNo()));
        }
    }

    public record Reason(String code, String message) {
    }

    public record GroupResponse<T>(KeyFactSection<T> current, KeyFactSection<T> previous,
            List<KeyFactChange> changes) {

        static <T> GroupResponse<T> from(Group<T> group) {
            return new GroupResponse<>(group.current(), group.previous(), group.changes());
        }
    }
}
