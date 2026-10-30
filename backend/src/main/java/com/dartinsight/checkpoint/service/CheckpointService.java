package com.dartinsight.checkpoint.service;

import com.dartinsight.checkpoint.domain.AuditFindings;
import com.dartinsight.checkpoint.domain.CheckpointItem;
import com.dartinsight.checkpoint.domain.CheckpointReason;
import com.dartinsight.checkpoint.domain.CheckpointRules;
import com.dartinsight.checkpoint.domain.StatementStatus;
import com.dartinsight.checkpoint.domain.YearAccounts;
import com.dartinsight.common.error.ApiException;
import com.dartinsight.disclosure.domain.DisclosureGroup;
import com.dartinsight.disclosure.domain.DisclosureSignal;
import com.dartinsight.disclosure.domain.DisclosureSignalKind;
import com.dartinsight.disclosure.domain.DisclosureSignalStatus;
import com.dartinsight.disclosure.service.DisclosureService;
import com.dartinsight.disclosure.service.DisclosureService.DisclosureTimeline;
import com.dartinsight.disclosure.service.DisclosureSignalService;
import com.dartinsight.disclosure.service.DisclosureSignalService.DisclosureSignals;
import com.dartinsight.financial.domain.FinancialStatementFetch;
import com.dartinsight.financial.domain.FsDiv;
import com.dartinsight.financial.service.FinancialStatementService;
import com.dartinsight.followup.domain.AnnualReportPair;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.service.ReportService;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * 재무 체크 포인트(1.11, FS-62, docs/api-spec.md GET /api/companies/{corpCode}/checkpoints). LLM을 쓰지 않는다.
 * <ol>
 *   <li>가장 최근 사업보고서와 사업연도가 한 해 앞선 사업보고서를 고른다({@link AnnualReportPair})</li>
 *   <li>두 보고서의 전체 재무제표를 저장된 것에서, 없으면 OpenDART에서 받는다(올해는 연결 우선, 작년은 올해와 같은 기준).
 *       OpenDART 호출은 {@link FinancialStatementService}가 트랜잭션 밖에서 하고 저장만 묶는다(LY-2)</li>
 *   <li>최근 1년 공시 목록의 '자금 조달' 묶음과 확인해 볼 공시의 감사의견 결과를 가져온다(같은 캐시)</li>
 *   <li>{@link CheckpointRules}로 일곱 항목을 계산한다. 결과는 저장하지 않는다</li>
 * </ol>
 * 재무제표·공시 자료를 받지 못한 것은 에러가 아니라 그 항목의 '자료 없음'으로 돌려준다.
 */
@Service
@RequiredArgsConstructor
public class CheckpointService {

    private static final Logger log = LoggerFactory.getLogger(CheckpointService.class);

    private final ReportService reportService;
    private final FinancialStatementService financialStatementService;
    private final DisclosureService disclosureService;
    private final DisclosureSignalService disclosureSignalService;

    public CompanyCheckpoints get(String corpCode) {
        AnnualReportPair pair = AnnualReportPair.of(reportService.list(corpCode).reports());
        if (pair.missing().isPresent()) {
            return CompanyCheckpoints.notAvailable(corpCode, pair, CheckpointReason.of(pair.missing().get()));
        }
        Statements statements = statements(pair);
        Optional<DisclosureTimeline> funding = fundingDisclosures(corpCode);
        Optional<DisclosureSignals> signals = disclosureSignals(corpCode);
        List<CheckpointItem> items = CheckpointRules.all(statements.current(), statements.previous(),
                funding.map(DisclosureTimeline::items), auditFindings(signals),
                signalCount(signals, DisclosureSignalKind.AUDITOR_CHANGE));
        return new CompanyCheckpoints(corpCode, null, pair.current(), pair.previous(), statements.fsDiv(),
                statements.status(), funding.map(DisclosureTimeline::from).orElse(null),
                funding.map(DisclosureTimeline::to).orElse(null), items);
    }

    /** 올해는 연결 우선, 작년은 올해와 같은 기준. 받지 못한 쪽은 비운다 */
    private Statements statements(AnnualReportPair pair) {
        Optional<FinancialStatementFetch> current;
        try {
            current = financialStatementService.fetchPreferConsolidated(pair.current());
        } catch (ApiException e) {
            log.warn("재무 체크 포인트의 올해 재무제표를 받지 못했습니다 {}: {}", pair.current().getRceptNo(), e.errorCode());
            return new Statements(null, StatementStatus.FETCH_FAILED, YearAccounts.empty(), YearAccounts.empty());
        }
        if (current.isEmpty() || !current.get().hasData()) {
            return new Statements(null, StatementStatus.NOT_AVAILABLE, YearAccounts.empty(), YearAccounts.empty());
        }
        FsDiv fsDiv = current.get().getFsDiv();
        YearAccounts currentAccounts = YearAccounts.of(financialStatementService.accounts(current.get()), fsDiv);
        try {
            Optional<FinancialStatementFetch> previous = financialStatementService.fetch(pair.previous(), fsDiv)
                    .filter(FinancialStatementFetch::hasData);
            return previous
                    .map(p -> new Statements(fsDiv, StatementStatus.AVAILABLE, currentAccounts,
                            YearAccounts.of(financialStatementService.accounts(p), fsDiv)))
                    .orElseGet(() -> new Statements(fsDiv, StatementStatus.NOT_AVAILABLE, currentAccounts,
                            YearAccounts.empty()));
        } catch (ApiException e) {
            log.warn("재무 체크 포인트의 작년 재무제표를 받지 못했습니다 {}: {}", pair.previous().getRceptNo(), e.errorCode());
            return new Statements(fsDiv, StatementStatus.FETCH_FAILED, currentAccounts, YearAccounts.empty());
        }
    }

    /** 최근 1년 '자금 조달' 묶음 공시(최근 공시 타임라인과 같은 목록). 받지 못하면 빈 값 */
    private Optional<DisclosureTimeline> fundingDisclosures(String corpCode) {
        try {
            return Optional.of(disclosureService.timeline(corpCode, DisclosureSignalService.DAYS,
                    DisclosureGroup.FUNDING));
        } catch (ApiException e) {
            log.warn("재무 체크 포인트의 공시 목록을 받지 못했습니다 {}: {}", corpCode, e.errorCode());
            return Optional.empty();
        }
    }

    /** 확인해 볼 공시(FS-55). 받지 못하면 빈 값 */
    private Optional<DisclosureSignals> disclosureSignals(String corpCode) {
        try {
            return Optional.of(disclosureSignalService.signals(corpCode));
        } catch (ApiException e) {
            log.warn("재무 체크 포인트의 확인해 볼 공시를 만들지 못했습니다 {}: {}", corpCode, e.errorCode());
            return Optional.empty();
        }
    }

    /** 적정이 아닌 감사의견이 적힌 사업보고서와 계속기업 문구가 있는 사업보고서. 확인하지 못했으면 빈 값 */
    private static Optional<AuditFindings> auditFindings(Optional<DisclosureSignals> signals) {
        return signals
                .filter(s -> s.statuses().get(DisclosureSignalKind.NON_CLEAN_AUDIT_OPINION)
                        == DisclosureSignalStatus.CHECKED)
                .map(s -> new AuditFindings(s.items().stream()
                        .filter(item -> item.kind() == DisclosureSignalKind.NON_CLEAN_AUDIT_OPINION)
                        .map(DisclosureSignal::disclosure)
                        .toList(), s.goingConcern()));
    }

    /** 종류의 건수. 확인하지 못했으면 null */
    private static Integer signalCount(Optional<DisclosureSignals> signals, DisclosureSignalKind kind) {
        return signals.map(s -> s.counts().get(kind)).orElse(null);
    }

    private record Statements(FsDiv fsDiv, StatementStatus status, YearAccounts current, YearAccounts previous) {
    }

    /**
     * 체크 포인트 결과.
     *
     * @param reason         계산하지 않았으면 그 사유, 아니면 null
     * @param fsDiv          쓴 재무제표 기준. 올해 재무제표가 없으면 null
     * @param statementStatus 계산하지 않았으면 null
     * @param disclosureFrom 자금 조달 공시를 센 기간. 공시 목록을 받지 못했으면 null
     */
    public record CompanyCheckpoints(String corpCode, CheckpointReason reason, Report current, Report previous,
            FsDiv fsDiv, StatementStatus statementStatus, LocalDate disclosureFrom, LocalDate disclosureTo,
            List<CheckpointItem> items) {

        static CompanyCheckpoints notAvailable(String corpCode, AnnualReportPair pair, CheckpointReason reason) {
            return new CompanyCheckpoints(corpCode, reason, pair.current(), pair.previous(), null, null, null, null,
                    List.of());
        }

        public boolean available() {
            return reason == null;
        }
    }
}
