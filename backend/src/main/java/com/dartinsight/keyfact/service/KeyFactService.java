package com.dartinsight.keyfact.service;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.comparison.domain.ComparisonBasis;
import com.dartinsight.comparison.service.ReportPairService;
import com.dartinsight.comparison.service.ReportPairService.ReportPair;
import com.dartinsight.dart.client.OpenDartClient;
import com.dartinsight.dart.client.OpenDartClient.PeriodicReportInfoPage;
import com.dartinsight.dart.dto.DividendItem;
import com.dartinsight.dart.dto.ExecutiveItem;
import com.dartinsight.dart.dto.MajorShareholderItem;
import com.dartinsight.keyfact.domain.Dividend;
import com.dartinsight.keyfact.domain.Executive;
import com.dartinsight.keyfact.domain.KeyFactChange;
import com.dartinsight.keyfact.domain.KeyFactKind;
import com.dartinsight.keyfact.domain.KeyFactSection;
import com.dartinsight.keyfact.domain.KeyFactStatus;
import com.dartinsight.keyfact.domain.MajorShareholder;
import com.dartinsight.keyfact.repository.ReportKeyFactStore;
import com.dartinsight.report.domain.FinancialDataStatus;
import com.dartinsight.report.domain.Report;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.function.BiFunction;
import java.util.function.Function;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * 최대주주·임원·배당 변화(#331, FS-47). 가장 최근 정기보고서와 같은 종류의 1년 전 보고서의 정기보고서 주요정보를
 * 나란히 놓고, 같은 행을 짝지어 바뀐 항목을 만든다.
 * 받은 결과는 접수번호·묶음마다 저장하고 다시 받지 않는다(자료 없음은 보고서 목록에서 다시 봤을 때 한 번 더 받음).
 * OpenDART 호출은 트랜잭션 밖에서 하고, 한 묶음을 받지 못해도 응답 전체를 실패시키지 않는다(그 묶음만 UNAVAILABLE).
 */
@Service
@RequiredArgsConstructor
public class KeyFactService {

    private static final Logger log = LoggerFactory.getLogger(KeyFactService.class);

    private final ReportPairService reportPairService;
    private final OpenDartClient openDartClient;
    private final ReportKeyFactStore store;
    private final Clock clock;

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
        Optional<ReportKeyFactStore.Stored<T>> saved = store.find(report.getRceptNo(), fetcher.kind(),
                fetcher.rowType());
        if (saved.isPresent() && !needsRefetch(saved.get(), report)) {
            return saved.get().section();
        }
        if (report.getFiscalYear() < FinancialDataStatus.FIRST_FISCAL_YEAR) {
            // 정기보고서 주요정보는 2015 사업연도부터 제공된다
            return KeyFactSection.empty(report.getRceptNo(), KeyFactStatus.NO_DATA);
        }
        PeriodicReportInfoPage<I> page;
        try {
            page = fetcher.fetch().apply(report);
        } catch (ApiException e) {
            log.warn("정기보고서 주요정보를 받지 못했습니다 {} {}: {}", report.getRceptNo(), fetcher.kind(),
                    e.errorCode());
            return KeyFactSection.empty(report.getRceptNo(), KeyFactStatus.UNAVAILABLE);
        }
        KeyFactSection<T> section = toSection(report, page, fetcher);
        store.save(fetcher.kind(), section, LocalDateTime.now(clock).truncatedTo(ChronoUnit.MICROS));
        return section;
    }

    /**
     * 자료가 있으면 다시 받지 않는다. 자료 없음은 그 뒤에 보고서 목록에서 이 보고서를 다시 봤을 때 한 번 더 받는다
     * (제출 직후에는 아직 자료가 없을 수 있음).
     */
    static boolean needsRefetch(ReportKeyFactStore.Stored<?> saved, Report report) {
        return !saved.section().available() && report.getLastSeenAt().isAfter(saved.fetchedAt());
    }

    /** 응답이 이 보고서(접수번호)의 것이 아니면(정정본 등) 이 보고서의 자료가 없는 것으로 본다. */
    private static <T, I> KeyFactSection<T> toSection(Report report, PeriodicReportInfoPage<I> page,
            Fetcher<T, I> fetcher) {
        String rceptNo = report.getRceptNo();
        List<I> items = page.noData() ? List.of() : page.items().stream()
                .filter(item -> rceptNo.equals(clean(fetcher.itemRceptNo().apply(item))))
                .toList();
        if (items.isEmpty()) {
            if (!page.noData() && !page.items().isEmpty()) {
                log.info("정기보고서 주요정보가 다른 접수번호의 것이라 쓰지 않습니다 {} {}", rceptNo, fetcher.kind());
            }
            return KeyFactSection.empty(rceptNo, KeyFactStatus.NO_DATA);
        }
        LocalDate settlementDate = date(fetcher.itemSettlementDate().apply(items.get(0)));
        List<T> rows = items.stream().map(fetcher.toRow()).toList();
        return new KeyFactSection<>(rceptNo, KeyFactStatus.AVAILABLE, settlementDate, rows);
    }

    private static String reprtCode(Report report) {
        return report.getReportType().reprtCode();
    }

    private static MajorShareholder shareholder(MajorShareholderItem i) {
        return new MajorShareholder(name(i.name()), clean(i.relation()), clean(i.stockKind()), clean(i.beginShares()),
                clean(i.beginRatio()), clean(i.endShares()), clean(i.endRatio()), clean(i.remark()));
    }

    private static Executive executive(ExecutiveItem i) {
        return new Executive(name(i.name()), clean(i.position()), clean(i.registeredType()), clean(i.fullTime()),
                clean(i.duty()), clean(i.largestShareholderRelation()), clean(i.tenure()), clean(i.termEnd()));
    }

    private static Dividend dividend(DividendItem i) {
        return new Dividend(name(i.category()), clean(i.stockKind()), clean(i.currentTerm()), clean(i.priorTerm()),
                clean(i.twoTermsAgo()));
    }

    /** 원문 값 그대로. 앞뒤 공백만 지우고, '-'·빈 값은 null(없는 값). */
    static String clean(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.strip();
        return trimmed.isEmpty() || "-".equals(trimmed) ? null : trimmed;
    }

    /** 이름은 짝짓는 기준이라 줄바꿈·연속 공백을 공백 하나로 바꾼다(원문 표의 줄바꿈). */
    static String name(String value) {
        String cleaned = clean(value);
        return cleaned == null ? null : cleaned.replaceAll("\\s+", " ");
    }

    private static LocalDate date(String value) {
        String cleaned = clean(value);
        if (cleaned == null) {
            return null;
        }
        try {
            return LocalDate.parse(cleaned);
        } catch (DateTimeParseException e) {
            return null;
        }
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
