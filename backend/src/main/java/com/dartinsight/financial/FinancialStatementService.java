package com.dartinsight.financial;

import com.dartinsight.dart.FinancialStatementResponse;
import com.dartinsight.dart.OpenDartClient;
import com.dartinsight.report.FinancialDataStatus;
import com.dartinsight.report.FinancialDataStatusProvider;
import com.dartinsight.report.Report;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 보고서별 재무제표(4.5). OpenDART 단일회사 전체 재무제표를 받아 계정 값을 저장한다.
 * 같은 기업·사업연도·보고서 코드·기준(연결·별도)은 저장된 결과를 쓰고 다시 부르지 않는다(호출 한도).
 * 013(자료 없음)도 결과로 저장한다. 호출 실패는 저장하지 않는다.
 */
@Service
public class FinancialStatementService implements FinancialDataStatusProvider {

    private static final Logger log = LoggerFactory.getLogger(FinancialStatementService.class);

    private final OpenDartClient openDartClient;
    private final FinancialStatementFetchRepository fetchRepository;
    private final FinancialAccountRepository accountRepository;
    private final TransactionTemplate transactionTemplate;
    private final Clock clock;

    public FinancialStatementService(OpenDartClient openDartClient, FinancialStatementFetchRepository fetchRepository,
            FinancialAccountRepository accountRepository, TransactionTemplate transactionTemplate, Clock clock) {
        this.openDartClient = openDartClient;
        this.fetchRepository = fetchRepository;
        this.accountRepository = accountRepository;
        this.transactionTemplate = transactionTemplate;
        this.clock = clock;
    }

    /**
     * 보고서의 재무제표를 기준(연결·별도)별로 가져온다. 저장된 결과가 있으면 OpenDART를 부르지 않는다.
     * 재무제표 API가 제공하지 않는 사업연도(2015 이전)는 부르지 않고 빈 값을 돌려준다.
     */
    public Optional<FinancialStatementFetch> fetch(Report report, FsDiv fsDiv) {
        if (report.getFiscalYear() < FinancialDataStatus.FIRST_FISCAL_YEAR) {
            return Optional.empty();
        }
        String reprtCode = report.getReportType().reprtCode();
        Optional<FinancialStatementFetch> saved = find(report.getCorpCode(), report.getFiscalYear(), reprtCode, fsDiv);
        if (saved.isPresent()) {
            return saved;
        }

        OpenDartClient.FinancialStatementPage page = openDartClient.financialStatements(report.getCorpCode(),
                report.getFiscalYear(), reprtCode, fsDiv.name());
        LocalDateTime now = LocalDateTime.now(clock).truncatedTo(ChronoUnit.MICROS);
        try {
            return Optional.ofNullable(transactionTemplate.execute(status -> save(report, reprtCode, fsDiv, page, now)));
        } catch (DataIntegrityViolationException e) {
            // 같은 요청이 동시에 저장한 경우
            return find(report.getCorpCode(), report.getFiscalYear(), reprtCode, fsDiv);
        }
    }

    /** 연결 재무제표를 먼저 보고, 없으면(013) 별도 재무제표를 본다. */
    public Optional<FinancialStatementFetch> fetchPreferConsolidated(Report report) {
        Optional<FinancialStatementFetch> cfs = fetch(report, FsDiv.CFS);
        if (cfs.isPresent() && cfs.get().hasData()) {
            return cfs;
        }
        return fetch(report, FsDiv.OFS);
    }

    /** 원문 순서대로의 계정 값 */
    public List<FinancialAccount> accounts(FinancialStatementFetch fetch) {
        return fetch.hasData() ? accountRepository.findByFetchIdOrderBySjDivAscOrdAscIdAsc(fetch.getId()) : List.of();
    }

    private Optional<FinancialStatementFetch> find(String corpCode, int fiscalYear, String reprtCode, FsDiv fsDiv) {
        return fetchRepository.findByCorpCodeAndFiscalYearAndReprtCodeAndFsDiv(corpCode, fiscalYear, reprtCode, fsDiv);
    }

    private FinancialStatementFetch save(Report report, String reprtCode, FsDiv fsDiv,
            OpenDartClient.FinancialStatementPage page, LocalDateTime now) {
        List<FinancialStatementResponse.Item> items = page.items();
        boolean hasData = !page.noData() && !items.isEmpty();
        String rceptNo = hasData ? firstRceptNo(items, report.getRceptNo()) : null;
        FinancialStatementFetch fetch = fetchRepository.save(new FinancialStatementFetch(report.getCorpCode(),
                report.getFiscalYear(), reprtCode, fsDiv, hasData ? FetchStatus.OK : FetchStatus.NO_DATA, rceptNo,
                now));
        if (hasData) {
            accountRepository.saveAll(items.stream()
                    .filter(i -> i.sjDiv() != null && i.accountName() != null)
                    .map(i -> toAccount(fetch.getId(), rceptNo, i))
                    .toList());
        }
        log.info("재무제표 저장 {} {} {} {}: {} 계정 {}건", report.getCorpCode(), report.getFiscalYear(), reprtCode,
                fsDiv, fetch.getStatus(), hasData ? items.size() : 0);
        return fetch;
    }

    private static String firstRceptNo(List<FinancialStatementResponse.Item> items, String fallback) {
        return items.stream()
                .map(FinancialStatementResponse.Item::rceptNo)
                .filter(no -> no != null && !no.isBlank())
                .findFirst()
                .orElse(fallback);
    }

    private static FinancialAccount toAccount(Long fetchId, String fetchRceptNo, FinancialStatementResponse.Item i) {
        String rceptNo = i.rceptNo() == null || i.rceptNo().isBlank() ? fetchRceptNo : i.rceptNo();
        String accountId = i.accountId() == null || i.accountId().isBlank()
                ? FinancialAccount.NON_STANDARD_ACCOUNT_ID : i.accountId().trim();
        return new FinancialAccount(fetchId, rceptNo, i.sjDiv().trim(), blankToNull(i.sjName()), accountId,
                i.accountName().trim(), detailOrNull(i.accountDetail()), Amounts.parseInt(i.ord()),
                blankToNull(i.currency()), blankToNull(i.thstrmName()), blankToNull(i.frmtrmName()),
                Amounts.parse(i.thstrmAmount()), Amounts.parse(i.thstrmAddAmount()), Amounts.parse(i.frmtrmAmount()),
                Amounts.parse(i.frmtrmQAmount()), Amounts.parse(i.frmtrmAddAmount()));
    }

    /** 계정 상세는 자본변동표에만 있고, 나머지는 '-'로 온다 */
    private static String detailOrNull(String value) {
        String detail = blankToNull(value);
        return "-".equals(detail) ? null : detail;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    /**
     * 받아 둔 결과로 보고서별 재무 자료 상태를 정한다. OpenDART를 부르지 않는다.
     * <ul>
     *   <li>AVAILABLE: 연결이나 별도 자료가 있고, 그 자료의 접수번호가 이 보고서다</li>
     *   <li>NOT_AVAILABLE: 2015 사업연도 이전, 연결·별도 모두 자료 없음(013), 또는 자료가 다른 접수번호(정정본) 것</li>
     *   <li>UNKNOWN: 아직 받아 보지 않음</li>
     * </ul>
     */
    @Override
    public Map<String, FinancialDataStatus> statuses(String corpCode, List<Report> reports) {
        Map<String, List<FinancialStatementFetch>> byKey = fetchRepository.findByCorpCode(corpCode).stream()
                .collect(Collectors.groupingBy(f -> f.getFiscalYear() + ":" + f.getReprtCode()));
        Map<String, FinancialDataStatus> result = new HashMap<>();
        for (Report report : reports) {
            List<FinancialStatementFetch> fetches = byKey.getOrDefault(
                    report.getFiscalYear() + ":" + report.getReportType().reprtCode(), List.of());
            result.put(report.getRceptNo(), statusOf(report, fetches));
        }
        return result;
    }

    static FinancialDataStatus statusOf(Report report, List<FinancialStatementFetch> fetches) {
        if (report.getFiscalYear() < FinancialDataStatus.FIRST_FISCAL_YEAR) {
            return FinancialDataStatus.NOT_AVAILABLE;
        }
        List<FinancialStatementFetch> withData = fetches.stream().filter(FinancialStatementFetch::hasData).toList();
        if (withData.stream().anyMatch(f -> report.getRceptNo().equals(f.getRceptNo()))) {
            return FinancialDataStatus.AVAILABLE;
        }
        if (!withData.isEmpty()) {
            return FinancialDataStatus.NOT_AVAILABLE;
        }
        boolean cfsNoData = fetches.stream().anyMatch(f -> f.getFsDiv() == FsDiv.CFS);
        boolean ofsNoData = fetches.stream().anyMatch(f -> f.getFsDiv() == FsDiv.OFS);
        return cfsNoData && ofsNoData ? FinancialDataStatus.NOT_AVAILABLE : FinancialDataStatus.UNKNOWN;
    }
}
