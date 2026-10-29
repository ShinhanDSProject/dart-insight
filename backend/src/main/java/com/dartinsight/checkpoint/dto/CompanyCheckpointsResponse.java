package com.dartinsight.checkpoint.dto;

import com.dartinsight.checkpoint.domain.CheckpointFact;
import com.dartinsight.checkpoint.domain.CheckpointItem;
import com.dartinsight.checkpoint.domain.CheckpointKey;
import com.dartinsight.checkpoint.domain.CheckpointReason;
import com.dartinsight.checkpoint.domain.CheckpointStatus;
import com.dartinsight.checkpoint.domain.StatementStatus;
import com.dartinsight.checkpoint.service.CheckpointService.CompanyCheckpoints;
import com.dartinsight.disclosure.domain.Disclosure;
import com.dartinsight.financial.domain.FsDiv;
import com.dartinsight.report.domain.DartLinks;
import com.dartinsight.report.domain.Report;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * 재무 체크 포인트 응답(docs/api-spec.md GET /api/companies/{corpCode}/checkpoints).
 *
 * @param status AVAILABLE 계산함(items에 일곱 항목), NOT_AVAILABLE 사업보고서 두 개가 없음(items 빈 배열)
 */
public record CompanyCheckpointsResponse(String corpCode, String status, CheckpointReason reason, String message,
        ReportRef currentReport, ReportRef previousReport, FsDiv fsDiv, StatementStatus statementStatus,
        LocalDate disclosureFrom, LocalDate disclosureTo, List<Item> items) {

    public static CompanyCheckpointsResponse from(CompanyCheckpoints result) {
        return new CompanyCheckpointsResponse(result.corpCode(), result.available() ? "AVAILABLE" : "NOT_AVAILABLE",
                result.reason(), result.reason() == null ? null : result.reason().message(),
                ReportRef.of(result.current()), ReportRef.of(result.previous()), result.fsDiv(),
                result.statementStatus(), result.disclosureFrom(), result.disclosureTo(),
                result.items().stream().map(Item::from).toList());
    }

    public record ReportRef(String rceptNo, String reportName, int fiscalYear, LocalDate periodEnd, String dartUrl) {

        static ReportRef of(Report report) {
            return report == null ? null : new ReportRef(report.getRceptNo(), report.getReportName(),
                    report.getFiscalYear(), report.getPeriodEnd(), DartLinks.viewer(report.getRceptNo()));
        }
    }

    public record Item(CheckpointKey key, String title, CheckpointStatus status, String statusLabel, String why,
            String formula, String threshold, String note, List<Fact> facts, List<DisclosureRef> disclosures) {

        static Item from(CheckpointItem item) {
            CheckpointKey key = item.key();
            return new Item(key, key.title(), item.status(), item.status().label(), key.why(), key.formula(),
                    key.threshold(), item.note(), item.facts().stream().map(Fact::from).toList(),
                    item.disclosures().stream().map(DisclosureRef::from).toList());
        }
    }

    /** @param value 없으면 null(0과 구분), 그때 reason이 이유 */
    public record Fact(String label, BigDecimal value, CheckpointFact.Unit unit, String currency,
            CheckpointFact.Reason reason, Evidence evidence) {

        static Fact from(CheckpointFact fact) {
            return new Fact(fact.label(), fact.value(), fact.unit(), fact.currency(), fact.reason(),
                    Evidence.from(fact.evidence()));
        }
    }

    public record Evidence(String rceptNo, FsDiv fsDiv, String sjDiv, String statementName, String accountId,
            String accountName, String dartUrl) {

        static Evidence from(CheckpointFact.Evidence evidence) {
            return evidence == null ? null : new Evidence(evidence.rceptNo(), evidence.fsDiv(), evidence.sjDiv(),
                    evidence.statementName(), evidence.accountId(), evidence.accountName(),
                    DartLinks.viewer(evidence.rceptNo()));
        }
    }

    public record DisclosureRef(String rceptNo, String reportName, LocalDate receivedDate, String dartUrl) {

        static DisclosureRef from(Disclosure disclosure) {
            return new DisclosureRef(disclosure.rceptNo(), disclosure.displayName(), disclosure.rceptDt(),
                    DartLinks.viewer(disclosure.rceptNo()));
        }
    }
}
