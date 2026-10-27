package com.dartinsight.financial.service;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.dart.client.OpenDartClient;
import com.dartinsight.dart.domain.CachePolicy;
import com.dartinsight.dart.dto.KeyAccountResponse;
import com.dartinsight.dart.service.DartCacheLoader;
import com.dartinsight.financial.domain.Amounts;
import com.dartinsight.financial.domain.FetchStatus;
import com.dartinsight.financial.domain.FsDiv;
import com.dartinsight.financial.domain.KeyAccount;
import com.dartinsight.financial.domain.KeyAccountFetch;
import com.dartinsight.financial.domain.KeyAccountRow;
import com.dartinsight.financial.domain.TrendValue;
import com.dartinsight.financial.repository.KeyAccountStore;
import com.dartinsight.report.domain.FinancialDataStatus;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.service.ReportService;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * 최근 정기보고서들의 주요 재무 흐름(1.2, FS-46). 보고서마다 OpenDART 단일회사 주요계정을 한 번 받아 저장하고
 * 다시 받지 않는다(ADR-0024, DartCacheLoader의 permanent). 013(자료 없음)도 저장한다. 받지 못한 보고서는 저장하지
 * 않고 그 기간만 FETCH_FAILED로 돌려준다(다음 조회에서 다시 받음). OpenDART 호출은 트랜잭션 밖에서 하고, 저장만
 * DartCacheLoader가 묶는다(LY-2).
 */
@Service
@RequiredArgsConstructor
public class FinancialTrendService {

    public static final int DEFAULT_LIMIT = 8;
    public static final int MAX_LIMIT = 20;

    private static final Logger log = LoggerFactory.getLogger(FinancialTrendService.class);

    private final ReportService reportService;
    private final OpenDartClient openDartClient;
    private final KeyAccountStore store;
    private final DartCacheLoader cacheLoader;

    public FinancialTrend trend(String corpCode, FsDiv fsDiv, int limit) {
        ReportService.ReportList list = reportService.list(corpCode);
        List<Report> reports = list.reports().stream().limit(limit).toList();
        Map<String, KeyAccountFetch> fetches = new HashMap<>(
                store.fetches(reports.stream().map(Report::getRceptNo).toList()));
        Set<String> failed = loadMissing(corpCode, reports, fetches);
        Map<String, Map<KeyAccount, KeyAccountRow>> rows = rowsByReport(fetches.keySet(), fsDiv);
        List<TrendPeriod> periods = reports.stream()
                .map(r -> period(r, fetches.get(r.getRceptNo()), failed.contains(r.getRceptNo()),
                        rows.getOrDefault(r.getRceptNo(), Map.of())))
                .toList();
        return new FinancialTrend(corpCode, fsDiv, list.refreshError(), periods);
    }

    /**
     * 받아 둔 기록이 없는 보고서를 받아 fetches에 더한다. 받지 못한 보고서의 접수번호를 돌려준다.
     * 한도 초과·키 없음이면 남은 보고서도 같은 결과라 이번 요청에서 더 부르지 않고 받지 못한 것으로 둔다.
     */
    private Set<String> loadMissing(String corpCode, List<Report> reports, Map<String, KeyAccountFetch> fetches) {
        Set<String> failed = new HashSet<>();
        boolean stopCalling = false;
        for (Report report : reports) {
            if (!isProvided(report) || fetches.containsKey(report.getRceptNo())) {
                continue;
            }
            if (stopCalling) {
                failed.add(report.getRceptNo());
                continue;
            }
            try {
                KeyAccountFetch fetched = load(report);
                fetches.put(fetched.rceptNo(), fetched);
            } catch (ApiException e) {
                log.warn("주요계정을 받지 못했습니다 {} {}: {}", corpCode, report.getRceptNo(), e.errorCode());
                failed.add(report.getRceptNo());
                stopCalling = stopsCalling(e.errorCode());
            }
        }
        return failed;
    }

    private static boolean stopsCalling(ErrorCode code) {
        return code == ErrorCode.DART_RATE_LIMITED || code == ErrorCode.DART_KEY_MISSING;
    }

    /** 접수번호 → (계정 → 값). 저장된 순서를 지킨다 */
    private Map<String, Map<KeyAccount, KeyAccountRow>> rowsByReport(Set<String> rceptNos, FsDiv fsDiv) {
        Map<String, Map<KeyAccount, KeyAccountRow>> rows = new HashMap<>();
        for (KeyAccountRow row : store.rows(rceptNos, fsDiv)) {
            rows.computeIfAbsent(row.rceptNo(), k -> new LinkedHashMap<>()).put(row.account(), row);
        }
        return rows;
    }

    /** 주요계정 API는 2015 사업연도부터 제공한다(개발가이드). 그 전은 부르지 않는다. */
    private static boolean isProvided(Report report) {
        return report.getFiscalYear() >= FinancialDataStatus.FIRST_FISCAL_YEAR;
    }

    /**
     * 받아 둔 기록이 없는 보고서를 받아 저장한다. 저장된 기록은 trend가 한 번에 읽어 두므로 여기서는 늘 받는다.
     * 받지 못하면 저장된 값이 없어 ApiException이 그대로 나온다.
     */
    private KeyAccountFetch load(Report report) {
        String rceptNo = report.getRceptNo();
        return cacheLoader.load("주요계정 " + rceptNo, CachePolicy.permanent(), Optional::<KeyAccountFetch>empty,
                KeyAccountFetch::fetchedAt,
                () -> openDartClient.keyAccounts(report.getCorpCode(), report.getFiscalYear(),
                        report.getReportType().reprtCode()),
                (page, now) -> save(report, page, now)).value();
    }

    /** 트랜잭션 안. 같은 보고서를 동시에 먼저 저장했으면(DartCacheLoader가 한 번 더 부름) 저장된 기록을 쓴다. */
    private KeyAccountFetch save(Report report, OpenDartClient.KeyAccountPage page, LocalDateTime now) {
        KeyAccountFetch saved = store.fetches(List.of(report.getRceptNo())).get(report.getRceptNo());
        if (saved != null) {
            return saved;
        }
        List<KeyAccountRow> rows = page.noData() ? List.of() : toRows(report.getRceptNo(), page.items());
        String sourceRceptNo = rows.isEmpty() ? null : firstRceptNo(page.items());
        KeyAccountFetch fetch = new KeyAccountFetch(report.getRceptNo(),
                rows.isEmpty() ? FetchStatus.NO_DATA : FetchStatus.OK, sourceRceptNo, now);
        store.save(fetch, rows);
        log.info("주요계정 저장 {} {}: {} 계정 {}건", report.getCorpCode(), report.getRceptNo(), fetch.status(),
                rows.size());
        return fetch;
    }

    /**
     * 정해 둔 계정만 고른다. 같은 기준·계정이 두 줄이면(예: 당기순이익이 손익계산서와 포괄손익 앞에 한 번 더)
     * ord가 앞선 줄을 쓴다.
     */
    static List<KeyAccountRow> toRows(String rceptNo, List<KeyAccountResponse.Item> items) {
        Map<String, KeyAccountRow> chosen = new LinkedHashMap<>();
        items.stream()
                .sorted(Comparator.comparing((KeyAccountResponse.Item i) -> Amounts.parseInt(i.ord()),
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .forEach(item -> {
                    Optional<FsDiv> fsDiv = FsDiv.fromOpenDart(item.fsDiv());
                    Optional<KeyAccount> account = KeyAccount.fromAccountName(item.accountName());
                    if (fsDiv.isEmpty() || account.isEmpty()) {
                        return;
                    }
                    String sjDiv = item.sjDiv() == null || item.sjDiv().isBlank()
                            ? account.get().sjDiv() : item.sjDiv().trim();
                    chosen.putIfAbsent(fsDiv.get() + ":" + account.get(), new KeyAccountRow(rceptNo, fsDiv.get(),
                            account.get(), sjDiv, item.accountName().trim(), Amounts.parseInt(item.ord()),
                            Amounts.parse(item.thstrmAmount()), Amounts.parse(item.thstrmAddAmount()),
                            blankToNull(item.currency())));
                });
        return new ArrayList<>(chosen.values());
    }

    private static String firstRceptNo(List<KeyAccountResponse.Item> items) {
        return items.stream()
                .map(KeyAccountResponse.Item::rceptNo)
                .filter(no -> no != null && !no.isBlank())
                .map(String::trim)
                .findFirst()
                .orElse(null);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static TrendPeriod period(Report report, KeyAccountFetch fetch, boolean failed,
            Map<KeyAccount, KeyAccountRow> rows) {
        if (failed) {
            return new TrendPeriod(report, TrendDataStatus.FETCH_FAILED, null, Map.of());
        }
        if (fetch == null || fetch.status() != FetchStatus.OK || rows.isEmpty()) {
            return new TrendPeriod(report, TrendDataStatus.NOT_AVAILABLE, null, Map.of());
        }
        Map<KeyAccount, TrendValue> values = new LinkedHashMap<>();
        rows.forEach((account, row) -> values.put(account, TrendValue.of(report.getReportType(), row)));
        return new TrendPeriod(report, TrendDataStatus.AVAILABLE, fetch.sourceRceptNo(), values);
    }

    /** 기간의 주요계정 상태(docs/api-spec.md `dataStatus`) */
    public enum TrendDataStatus {
        AVAILABLE, NOT_AVAILABLE, FETCH_FAILED
    }

    /**
     * @param sourceRceptNo 값을 받은 공시의 접수번호(OpenDART 응답). 값이 없으면 null
     * @param values        계정 → 값. 응답에 없던 계정은 없다
     */
    public record TrendPeriod(Report report, TrendDataStatus status, String sourceRceptNo,
            Map<KeyAccount, TrendValue> values) {
    }

    /** @param refreshError 보고서 목록을 다시 받지 못해 저장된 목록을 썼을 때 그 이유. 아니면 null */
    public record FinancialTrend(String corpCode, FsDiv fsDiv, ErrorCode refreshError, List<TrendPeriod> periods) {
    }
}
