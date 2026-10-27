package com.dartinsight.keyfact.service;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.comparison.domain.ComparisonBasis;
import com.dartinsight.comparison.service.ReportPairService;
import com.dartinsight.comparison.service.ReportPairService.ReportPair;
import com.dartinsight.dart.client.OpenDartClient;
import com.dartinsight.dart.client.OpenDartClient.PeriodicReportInfoPage;
import com.dartinsight.dart.domain.CachePolicy;
import com.dartinsight.dart.domain.CacheResult;
import com.dartinsight.dart.dto.DividendItem;
import com.dartinsight.dart.dto.ExecutiveItem;
import com.dartinsight.dart.dto.MajorShareholderItem;
import com.dartinsight.dart.service.DartCacheLoader;
import com.dartinsight.keyfact.domain.Dividend;
import com.dartinsight.keyfact.domain.Executive;
import com.dartinsight.keyfact.domain.KeyFactChange;
import com.dartinsight.keyfact.domain.KeyFactChanges;
import com.dartinsight.keyfact.domain.KeyFactKind;
import com.dartinsight.keyfact.domain.KeyFactRows;
import com.dartinsight.keyfact.domain.KeyFactRows.Selected;
import com.dartinsight.keyfact.domain.KeyFactSection;
import com.dartinsight.keyfact.domain.KeyFactStatus;
import com.dartinsight.keyfact.domain.MajorShareholder;
import com.dartinsight.keyfact.repository.ReportKeyFactStore;
import com.dartinsight.report.domain.FinancialDataStatus;
import com.dartinsight.report.domain.Report;
import java.time.LocalDate;
import java.util.List;
import java.util.function.BiFunction;
import java.util.function.Function;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * 최대주주·임원·배당 변화(#331, FS-47). 가장 최근 정기보고서와 같은 종류의 1년 전 보고서의 정기보고서 주요정보를
 * 나란히 놓고, 같은 행을 짝지어 바뀐 항목을 만든다.
 * 받은 결과는 접수번호·묶음마다 저장하고 다시 받지 않는다(ADR-0024, DartCacheLoader의 permanent. 자료 없음은 보고서
 * 목록에서 다시 봤을 때 한 번 더 받음).
 * 정정 공시의 값은 그 접수번호(sourceRceptNo)와 함께 받는다(#350, toSection).
 * OpenDART 호출은 트랜잭션 밖에서 하고 저장만 DartCacheLoader가 묶는다(LY-2). 한 묶음을 받지 못해도 응답 전체를
 * 실패시키지 않는다(그 묶음만 UNAVAILABLE).
 */
@Service
@RequiredArgsConstructor
public class KeyFactService {

    private static final Logger log = LoggerFactory.getLogger(KeyFactService.class);

    private final ReportPairService reportPairService;
    private final OpenDartClient openDartClient;
    private final ReportKeyFactStore store;
    private final DartCacheLoader cacheLoader;

    public KeyFacts keyFacts(String corpCode) {
        ReportPair pair = reportPairService.findPair(corpCode, ComparisonBasis.YOY, null);
        Report current = pair.current();
        Report previous = pair.previous();

        Group<MajorShareholder> shareholders = group(current, previous, KeyFactKind.MAJOR_SHAREHOLDERS,
                MajorShareholder.class,
                r -> openDartClient.majorShareholders(r.getCorpCode(), r.getFiscalYear(), reprtCode(r)),
                MajorShareholderItem::rceptNo, MajorShareholderItem::settlementDate, KeyFactService::shareholder,
                KeyFactChanges::majorShareholders);
        Group<Executive> executives = group(current, previous, KeyFactKind.EXECUTIVES, Executive.class,
                r -> openDartClient.executives(r.getCorpCode(), r.getFiscalYear(), reprtCode(r)),
                ExecutiveItem::rceptNo, ExecutiveItem::settlementDate, KeyFactService::executive,
                KeyFactChanges::executives);
        Group<Dividend> dividends = group(current, previous, KeyFactKind.DIVIDENDS, Dividend.class,
                r -> openDartClient.dividends(r.getCorpCode(), r.getFiscalYear(), reprtCode(r)),
                DividendItem::rceptNo, DividendItem::settlementDate, KeyFactService::dividend,
                KeyFactChanges::dividends);
        return new KeyFacts(corpCode, pair, shareholders, executives, dividends);
    }

    private <T, I> Group<T> group(Report current, Report previous, KeyFactKind kind, Class<T> rowType,
            Function<Report, PeriodicReportInfoPage<I>> fetch, Function<I, String> itemRceptNo,
            Function<I, String> itemSettlementDate, Function<I, T> toRow,
            BiFunction<List<T>, List<T>, List<KeyFactChange>> compare) {
        Fetcher<T, I> fetcher = new Fetcher<>(kind, rowType, fetch, itemRceptNo, itemSettlementDate, toRow);
        KeyFactSection<T> now = current == null ? null : section(current, fetcher);
        KeyFactSection<T> before = previous == null ? null : section(previous, fetcher);
        List<KeyFactChange> changes = now != null && before != null && now.available() && before.available()
                ? compare.apply(before.rows(), now.rows()) : List.of();
        return new Group<>(now, before, changes);
    }

    private <T, I> KeyFactSection<T> section(Report report, Fetcher<T, I> fetcher) {
        if (report.getFiscalYear() < FinancialDataStatus.FIRST_FISCAL_YEAR) {
            // 정기보고서 주요정보는 2015 사업연도부터 제공된다(그래서 저장한 적도 없다)
            return KeyFactSection.empty(report.getRceptNo(), KeyFactStatus.NO_DATA);
        }
        CacheResult<ReportKeyFactStore.Stored<T>> result;
        try {
            result = cacheLoader.load("정기보고서 주요정보 " + report.getRceptNo() + " " + fetcher.kind(),
                    CachePolicy.permanent(),
                    () -> store.find(report.getRceptNo(), fetcher.kind(), fetcher.rowType()),
                    ReportKeyFactStore.Stored::fetchedAt,
                    saved -> !needsRefetch(saved, report),
                    () -> toSection(report, fetcher.fetch().apply(report), fetcher),
                    (section, now) -> {
                        store.save(fetcher.kind(), section, now);
                        return new ReportKeyFactStore.Stored<>(section, now);
                    });
        } catch (ApiException e) {
            log.warn("정기보고서 주요정보를 받지 못했습니다 {} {}: {}", report.getRceptNo(), fetcher.kind(),
                    e.errorCode());
            return KeyFactSection.empty(report.getRceptNo(), KeyFactStatus.UNAVAILABLE);
        }
        if (result.refreshError() != null) {
            // 저장된 자료 없음(NO_DATA)을 다시 받다 실패했다. 옛 결과 대신 받지 못했다고 돌려준다
            return KeyFactSection.empty(report.getRceptNo(), KeyFactStatus.UNAVAILABLE);
        }
        return result.value().section();
    }

    /**
     * 자료가 있으면 다시 받지 않는다. 자료 없음은 그 뒤에 보고서 목록에서 이 보고서를 다시 봤을 때 한 번 더 받는다
     * (제출 직후에는 아직 자료가 없을 수 있음).
     */
    static boolean needsRefetch(ReportKeyFactStore.Stored<?> saved, Report report) {
        return !saved.section().available() && report.getLastSeenAt().isAfter(saved.fetchedAt());
    }

    /**
     * 응답에서 쓸 행을 골라({@link KeyFactRows#select}) 묶음 결과로 만든다. 정정본 값이면 그 접수번호를 sourceRceptNo로 둔다.
     * 결산기준일(stlm_dt)이 보고서의 대상 기간 끝과 다르면 다른 기간의 자료라 NO_DATA다. stlm_dt가 없으면 요청한
     * 사업연도·보고서 코드의 응답이므로 받는다.
     */
    private static <T, I> KeyFactSection<T> toSection(Report report, PeriodicReportInfoPage<I> page,
            Fetcher<T, I> fetcher) {
        String rceptNo = report.getRceptNo();
        Selected<I> selected = KeyFactRows.select(rceptNo, page.noData() ? List.of() : page.items(),
                fetcher.itemRceptNo());
        if (selected.items().isEmpty()) {
            return KeyFactSection.empty(rceptNo, KeyFactStatus.NO_DATA);
        }
        LocalDate settlementDate = KeyFactRows.date(fetcher.itemSettlementDate().apply(selected.items().get(0)));
        if (!KeyFactRows.samePeriod(settlementDate, report.getPeriodEnd())) {
            log.info("정기보고서 주요정보가 다른 기간의 것이라 쓰지 않습니다 {} {}: 결산기준일 {}", rceptNo, fetcher.kind(),
                    settlementDate);
            return KeyFactSection.empty(rceptNo, KeyFactStatus.NO_DATA);
        }
        List<T> rows = selected.items().stream().map(fetcher.toRow()).toList();
        return new KeyFactSection<>(rceptNo, selected.sourceRceptNo(rceptNo), KeyFactStatus.AVAILABLE,
                settlementDate, rows);
    }

    private static String reprtCode(Report report) {
        return report.getReportType().reprtCode();
    }

    private static MajorShareholder shareholder(MajorShareholderItem i) {
        return new MajorShareholder(KeyFactRows.name(i.name()), KeyFactRows.clean(i.relation()),
                KeyFactRows.clean(i.stockKind()), KeyFactRows.clean(i.beginShares()),
                KeyFactRows.clean(i.beginRatio()), KeyFactRows.clean(i.endShares()), KeyFactRows.clean(i.endRatio()),
                KeyFactRows.clean(i.remark()));
    }

    private static Executive executive(ExecutiveItem i) {
        return new Executive(KeyFactRows.name(i.name()), KeyFactRows.clean(i.position()),
                KeyFactRows.clean(i.registeredType()), KeyFactRows.clean(i.fullTime()), KeyFactRows.clean(i.duty()),
                KeyFactRows.clean(i.largestShareholderRelation()), KeyFactRows.clean(i.tenure()),
                KeyFactRows.clean(i.termEnd()));
    }

    private static Dividend dividend(DividendItem i) {
        return new Dividend(KeyFactRows.name(i.category()), KeyFactRows.clean(i.stockKind()),
                KeyFactRows.clean(i.currentTerm()), KeyFactRows.clean(i.priorTerm()),
                KeyFactRows.clean(i.twoTermsAgo()));
    }

    private record Fetcher<T, I>(KeyFactKind kind, Class<T> rowType, Function<Report, PeriodicReportInfoPage<I>> fetch,
            Function<I, String> itemRceptNo, Function<I, String> itemSettlementDate, Function<I, T> toRow) {
    }

    /**
     * @param current  현재 보고서의 묶음 결과. 보고서가 없으면 null
     * @param previous 이전 보고서의 묶음 결과. 보고서가 없으면 null
     * @param changes  두 결과가 모두 AVAILABLE일 때만 채운다
     */
    public record Group<T>(KeyFactSection<T> current, KeyFactSection<T> previous, List<KeyFactChange> changes) {
    }

    public record KeyFacts(String corpCode, ReportPair pair, Group<MajorShareholder> majorShareholders,
            Group<Executive> executives, Group<Dividend> dividends) {
    }
}
