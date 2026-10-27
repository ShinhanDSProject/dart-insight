package com.dartinsight.disclosure.service;

import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.company.service.CompanyService;
import com.dartinsight.dart.client.OpenDartClient;
import com.dartinsight.dart.domain.CachePolicy;
import com.dartinsight.dart.domain.CacheResult;
import com.dartinsight.dart.service.DartCacheLoader;
import com.dartinsight.disclosure.config.DisclosureProperties;
import com.dartinsight.disclosure.domain.Disclosure;
import com.dartinsight.disclosure.domain.DisclosureFetch;
import com.dartinsight.disclosure.domain.DisclosureGroup;
import com.dartinsight.disclosure.repository.DisclosureStore;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * 기업의 최근 공시 타임라인(1.2, #332). 목록은 기업별로 저장해 두고, 받은 지 정한 시간이 지났거나 받은 기간이
 * 요청 기간을 덮지 못하면 OpenDART에서 다시 받는다(ADR-0024, DartCacheLoader). OpenDART 호출은 트랜잭션 밖에서
 * 하고 저장만 DartCacheLoader가 묶는다(LY-2).
 */
@Service
@RequiredArgsConstructor
public class DisclosureService {

    private static final Logger log = LoggerFactory.getLogger(DisclosureService.class);

    private final OpenDartClient openDartClient;
    private final CompanyService companyService;
    private final DisclosureStore store;
    private final DisclosureProperties properties;
    private final DartCacheLoader cacheLoader;
    private final Clock clock;

    /**
     * 최근 days일(오늘 − days일 ~ 오늘)의 공시. group이 있으면 그 묶음만 items에 넣고, 묶음별 건수는 늘 기간 전체로 센다.
     */
    public DisclosureTimeline timeline(String corpCode, int days, DisclosureGroup group) {
        companyService.get(corpCode);
        // DB(DATETIME(6))에 저장되는 정밀도에 맞춘다
        LocalDateTime now = LocalDateTime.now(clock).truncatedTo(ChronoUnit.MICROS);
        LocalDate today = now.toLocalDate();
        LocalDate from = today.minusDays(days);

        CacheResult<DisclosureFetch> result = cacheLoader.load("최근 공시 목록 " + corpCode,
                CachePolicy.refreshAfter(properties.refreshAfter()),
                () -> store.findFetch(corpCode),
                DisclosureFetch::fetchedAt,
                saved -> saved.covers(from),
                () -> DisclosureListMapper.toDisclosures(corpCode,
                        openDartClient.listAllDisclosures(corpCode, from, today)),
                // 받은 기간(from~today)과 받은 시각이 맞도록 이 요청의 now로 저장한다
                (disclosures, loaderNow) -> save(new DisclosureFetch(corpCode, from, today, now), disclosures));
        DisclosureFetch fetch = result.value();
        ErrorCode refreshError = result.refreshError();

        LocalDate shownFrom = fetch.fromDate().isAfter(from) ? fetch.fromDate() : from;
        List<Disclosure> all = store.findSince(corpCode, shownFrom);
        return DisclosureTimeline.of(corpCode, days, shownFrom, fetch, refreshError, all, group);
    }

    /**
     * 트랜잭션 안. 저장된 목록과 받은 기록을 지우고 새로 넣는다. 같은 기업을 동시에 처음 받아 받은 기록을 두 번 넣으려
     * 하면 DartCacheLoader가 한 번 더 부르고, 다시 저장하면 앞의 것을 지우고 넣는다.
     */
    private DisclosureFetch save(DisclosureFetch fetch, List<Disclosure> disclosures) {
        store.replace(fetch, disclosures);
        log.info("최근 공시 목록 저장 {}: {}건 ({} ~ {})", fetch.corpCode(), disclosures.size(), fetch.fromDate(),
                fetch.toDate());
        return fetch;
    }

    /**
     * @param from         이번 응답이 다룬 접수일 기간 시작(저장된 목록이 요청 기간을 다 덮지 못하면 저장된 기간 시작)
     * @param to           접수일 기간 끝(목록을 받은 날)
     * @param refreshError 다시 받지 못해 저장된 목록을 돌려줄 때 그 이유. 아니면 null
     * @param counts       묶음별 건수(거르기와 관계없이 기간 전체, 모든 묶음)
     * @param items        거른 공시. 접수일이 최근인 순서
     */
    public record DisclosureTimeline(String corpCode, int days, LocalDate from, LocalDate to, LocalDateTime fetchedAt,
            ErrorCode refreshError, Map<DisclosureGroup, Integer> counts, List<Disclosure> items) {

        /** 묶음별 건수는 기간 전체(all)로 세고, group이 있으면 그 묶음만 items에 넣는다 */
        static DisclosureTimeline of(String corpCode, int days, LocalDate from, DisclosureFetch fetch,
                ErrorCode refreshError, List<Disclosure> all, DisclosureGroup group) {
            Map<DisclosureGroup, Integer> counts = new EnumMap<>(DisclosureGroup.class);
            for (DisclosureGroup g : DisclosureGroup.values()) {
                counts.put(g, 0);
            }
            List<Disclosure> items = new ArrayList<>();
            for (Disclosure disclosure : all) {
                DisclosureGroup g = disclosure.group();
                counts.merge(g, 1, Integer::sum);
                if (group == null || group == g) {
                    items.add(disclosure);
                }
            }
            return new DisclosureTimeline(corpCode, days, from, fetch.toDate(), fetch.fetchedAt(), refreshError,
                    counts, items);
        }
    }
}
