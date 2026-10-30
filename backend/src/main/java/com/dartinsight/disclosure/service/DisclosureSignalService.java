package com.dartinsight.disclosure.service;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.company.service.CompanyService;
import com.dartinsight.dart.client.OpenDartClient;
import com.dartinsight.dart.domain.CachePolicy;
import com.dartinsight.dart.domain.CacheResult;
import com.dartinsight.dart.service.DartCacheLoader;
import com.dartinsight.disclosure.config.DisclosureProperties;
import com.dartinsight.disclosure.domain.AuditOpinionRow;
import com.dartinsight.disclosure.domain.AuditOpinions;
import com.dartinsight.disclosure.domain.Disclosure;
import com.dartinsight.disclosure.domain.DisclosureSignal;
import com.dartinsight.disclosure.domain.DisclosureSignalKind;
import com.dartinsight.disclosure.domain.DisclosureSignalKind.Source;
import com.dartinsight.disclosure.domain.DisclosureSignalRules;
import com.dartinsight.disclosure.domain.DisclosureSignalStatus;
import com.dartinsight.disclosure.domain.GoingConcernFinding;
import com.dartinsight.disclosure.repository.DisclosureAuditOpinionStore;
import com.dartinsight.disclosure.service.DisclosureService.DisclosureTimeline;
import com.dartinsight.report.domain.ReportNameParser;
import com.dartinsight.report.domain.ReportNameParser.ParsedReportName;
import com.dartinsight.report.domain.ReportType;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * 확인해 볼 공시(FS-55, #411, ADR-0033). 최근 1년 공시 목록(최근 공시 타임라인과 같은 저장된 목록)의 제목과, 목록에 있는
 * 사업보고서의 회계감사인·감사의견으로 종류를 정한다. 결과는 저장하지 않고 요청 때 만든다.
 * 감사의견은 사업보고서 접수번호마다 저장하고(ADR-0024), OpenDART 호출은 트랜잭션 밖에서 한다(LY-2).
 * 자료 하나를 받지 못하면 그 자료로 정하는 종류만 UNAVAILABLE이다.
 */
@Service
@RequiredArgsConstructor
public class DisclosureSignalService {

    /** 최근 1년 */
    public static final int DAYS = 365;

    private static final Logger log = LoggerFactory.getLogger(DisclosureSignalService.class);

    private final CompanyService companyService;
    private final DisclosureService disclosureService;
    private final OpenDartClient openDartClient;
    private final DisclosureAuditOpinionStore auditOpinionStore;
    private final DisclosureProperties properties;
    private final DartCacheLoader cacheLoader;
    private final Clock clock;

    public DisclosureSignals signals(String corpCode) {
        companyService.get(corpCode);
        LocalDate today = LocalDate.now(clock);
        DisclosureTimeline timeline;
        try {
            timeline = disclosureService.timeline(corpCode, DAYS, null);
        } catch (ApiException e) {
            log.warn("확인해 볼 공시의 공시 목록을 받지 못했습니다 {}: {}", corpCode, e.errorCode());
            return DisclosureSignals.of(corpCode, today.minusDays(DAYS), today, Set.of(Source.values()), List.of(),
                    List.of());
        }

        List<DisclosureSignal> signals = new ArrayList<>();
        List<GoingConcernFinding> goingConcern = new ArrayList<>();
        for (Disclosure disclosure : timeline.items()) {
            DisclosureSignalRules.classify(disclosure.reportName()).ifPresent(kind ->
                    signals.add(new DisclosureSignal(kind, disclosure, kind.sentence())));
        }
        boolean auditUnavailable = !auditSignals(corpCode, timeline.items(), signals, goingConcern);
        signals.sort(Comparator.comparing((DisclosureSignal s) -> s.disclosure().rceptDt())
                .thenComparing(s -> s.disclosure().rceptNo())
                .reversed());
        Set<Source> unavailable = auditUnavailable ? Set.of(Source.AUDIT_OPINION) : Set.of();
        goingConcern.sort(Comparator.comparing((GoingConcernFinding f) -> f.disclosure().rceptDt())
                .thenComparing(f -> f.disclosure().rceptNo())
                .reversed());
        return DisclosureSignals.of(corpCode, timeline.from(), timeline.to(), unavailable, signals, goingConcern);
    }

    /**
     * 목록의 12월 결산 사업보고서마다(같은 사업연도는 최근 것 하나) 감사의견을 보고 신호를 더한다. 당기 계속기업 문구(#546)는
     * 신호가 아니라 goingConcern에 따로 모은다(재무 체크 포인트가 씀).
     *
     * @return 모두 확인했으면 true. 받지 못한 보고서가 있거나 사업연도를 정할 수 없는 사업보고서가 있으면 false
     */
    private boolean auditSignals(String corpCode, List<Disclosure> disclosures, List<DisclosureSignal> signals,
            List<GoingConcernFinding> goingConcern) {
        boolean checked = true;
        Set<Integer> years = new HashSet<>();
        for (Disclosure disclosure : disclosures) {
            if (!disclosure.isAnnualReport()) {
                continue;
            }
            Optional<ParsedReportName> parsed = ReportNameParser.parse(disclosure.reportName(), disclosure.remark())
                    .filter(p -> p.type() == ReportType.ANNUAL);
            if (parsed.isEmpty()) {
                // 결산월이 12월이 아닌 사업보고서는 사업연도를 정하지 않는다(ReportNameParser)
                log.info("사업연도를 정할 수 없는 사업보고서라 감사의견을 확인하지 않습니다 {}: {}", corpCode,
                        disclosure.rceptNo());
                checked = false;
                continue;
            }
            if (!years.add(parsed.get().fiscalYear())) {
                continue;
            }
            Optional<AuditOpinions> opinions = auditOpinions(corpCode, disclosure, parsed.get());
            if (opinions.isEmpty()) {
                checked = false;
                continue;
            }
            List<AuditOpinionRow> rows = opinions.get().rows();
            DisclosureSignalRules.auditorChange(rows).ifPresent(change -> signals.add(new DisclosureSignal(
                    DisclosureSignalKind.AUDITOR_CHANGE, disclosure, DisclosureSignalRules.auditorChangeSentence(change))));
            DisclosureSignalRules.nonCleanOpinion(rows).ifPresent(row -> signals.add(new DisclosureSignal(
                    DisclosureSignalKind.NON_CLEAN_AUDIT_OPINION, disclosure,
                    DisclosureSignalRules.auditOpinionSentence(row))));
            DisclosureSignalRules.goingConcern(rows).ifPresent(note -> goingConcern.add(
                    new GoingConcernFinding(disclosure, opinions.get().evidenceRceptNo(), note)));
        }
        return checked;
    }

    /** 저장된 것 또는 새로 받은 감사의견. 받지 못하면 빈 값 */
    private Optional<AuditOpinions> auditOpinions(String corpCode, Disclosure report, ParsedReportName parsed) {
        LocalDateTime noDataUntil = LocalDateTime.now(clock).minus(properties.refreshAfter());
        CacheResult<AuditOpinions> result;
        try {
            result = cacheLoader.load("감사의견 " + report.rceptNo(), CachePolicy.permanent(),
                    () -> auditOpinionStore.find(report.rceptNo()),
                    AuditOpinions::fetchedAt,
                    // 자료 없음은 제출 직후일 수 있어 정한 시간이 지나면 한 번 더 받는다
                    saved -> saved.available() || saved.fetchedAt().isAfter(noDataUntil),
                    () -> openDartClient.auditOpinions(corpCode, parsed.fiscalYear(), ReportType.ANNUAL.reprtCode()),
                    (page, now) -> {
                        AuditOpinions opinions = AuditOpinionMapper.toOpinions(report.rceptNo(), parsed, page, now);
                        auditOpinionStore.save(opinions);
                        return opinions;
                    });
        } catch (ApiException e) {
            log.warn("감사의견을 받지 못했습니다 {}: {}", report.rceptNo(), e.errorCode());
            return Optional.empty();
        }
        if (result.refreshError() != null) {
            // 저장된 자료 없음을 다시 받다 실패했다. 없다고 하지 않고 받지 못했다고 돌려준다
            return Optional.empty();
        }
        return Optional.of(result.value());
    }

    /**
     * @param from     확인한 접수일 기간 시작(저장된 목록이 1년을 다 덮지 못하면 저장된 기간 시작)
     * @param to       확인한 접수일 기간 끝
     * @param statuses 종류마다 상태(모든 종류)
     * @param counts   종류마다 건수. UNAVAILABLE이면 null
     * @param items    접수일이 최근인 순서. UNAVAILABLE 종류의 항목은 없다
     * @param goingConcern 당기 감사의견 자료에 계속기업 문구가 있는 사업보고서(#546, 접수일이 최근인 순서). 응답에는 넣지 않는다.
     *                 감사의견 자료가 UNAVAILABLE이면 빈 목록
     */
    public record DisclosureSignals(String corpCode, LocalDate from, LocalDate to,
            Map<DisclosureSignalKind, DisclosureSignalStatus> statuses, Map<DisclosureSignalKind, Integer> counts,
            List<DisclosureSignal> items, List<GoingConcernFinding> goingConcern) {

        static DisclosureSignals of(String corpCode, LocalDate from, LocalDate to, Set<Source> unavailable,
                List<DisclosureSignal> signals, List<GoingConcernFinding> goingConcern) {
            Map<DisclosureSignalKind, DisclosureSignalStatus> statuses = new EnumMap<>(DisclosureSignalKind.class);
            Map<DisclosureSignalKind, Integer> counts = new EnumMap<>(DisclosureSignalKind.class);
            for (DisclosureSignalKind kind : DisclosureSignalKind.values()) {
                boolean missing = unavailable.contains(kind.source());
                statuses.put(kind, missing ? DisclosureSignalStatus.UNAVAILABLE : DisclosureSignalStatus.CHECKED);
                if (!missing) {
                    counts.put(kind, 0);
                }
            }
            List<DisclosureSignal> items = signals.stream()
                    .filter(s -> !unavailable.contains(s.kind().source()))
                    .toList();
            for (DisclosureSignal signal : items) {
                counts.merge(signal.kind(), 1, Integer::sum);
            }
            List<GoingConcernFinding> found = unavailable.contains(Source.AUDIT_OPINION) ? List.of()
                    : List.copyOf(goingConcern);
            return new DisclosureSignals(corpCode, from, to, statuses, counts, items, found);
        }
    }
}
