package com.dartinsight.disclosure.service;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.company.service.CompanyService;
import com.dartinsight.dart.client.OpenDartClient;
import com.dartinsight.dart.dto.DisclosureListResponse;
import com.dartinsight.disclosure.config.DisclosureProperties;
import com.dartinsight.disclosure.domain.Disclosure;
import com.dartinsight.disclosure.domain.DisclosureFetch;
import com.dartinsight.disclosure.domain.DisclosureGroup;
import com.dartinsight.disclosure.repository.DisclosureStore;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 기업의 최근 공시 타임라인(1.2, #332). 목록은 기업별로 저장해 두고, 받은 지 정한 시간이 지났거나 받은 기간이
 * 요청 기간을 덮지 못하면 OpenDART에서 다시 받는다(ADR-0024). OpenDART 호출은 트랜잭션 밖에서 한다(ADR-0003).
 */
@Service
@RequiredArgsConstructor
public class DisclosureService {

    private static final Logger log = LoggerFactory.getLogger(DisclosureService.class);

    private final OpenDartClient openDartClient;
    private final CompanyService companyService;
    private final DisclosureStore store;
    private final DisclosureProperties properties;
    private final TransactionTemplate transactionTemplate;
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

        Optional<DisclosureFetch> saved = store.findFetch(corpCode);
        DisclosureFetch fetch;
        ErrorCode refreshError = null;
        if (saved.isPresent() && saved.get().covers(from, now, properties.refreshAfter())) {
            fetch = saved.get();
        } else {
            try {
                fetch = refresh(corpCode, from, today, now);
            } catch (ApiException e) {
                if (saved.isEmpty()) {
                    throw e;
                }
                log.warn("최근 공시 목록을 다시 받지 못해 저장된 목록을 씁니다: {} {}", corpCode, e.errorCode());
                fetch = saved.get();
                refreshError = e.errorCode();
            }
        }

        LocalDate shownFrom = fetch.fromDate().isAfter(from) ? fetch.fromDate() : from;
        List<Disclosure> all = store.findSince(corpCode, shownFrom);
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
        return new DisclosureTimeline(corpCode, days, shownFrom, fetch.toDate(), fetch.fetchedAt(), refreshError,
                counts, items);
    }

    private DisclosureFetch refresh(String corpCode, LocalDate from, LocalDate today, LocalDateTime now) {
        List<Disclosure> disclosures = toDisclosures(corpCode, openDartClient.listAllDisclosures(corpCode, from, today));
        DisclosureFetch fetch = new DisclosureFetch(corpCode, from, today, now);
        try {
            transactionTemplate.executeWithoutResult(status -> store.replace(fetch, disclosures));
        } catch (DataIntegrityViolationException e) {
            // 같은 기업을 동시에 처음 받으면 받은 기록을 두 번 넣으려 할 수 있다. 다시 저장하면 앞의 것을 지우고 넣는다
            log.info("최근 공시 목록을 동시에 저장해 다시 저장합니다: {}", corpCode);
            transactionTemplate.executeWithoutResult(status -> store.replace(fetch, disclosures));
        }
        log.info("최근 공시 목록 저장 {}: {}건 ({} ~ {})", corpCode, disclosures.size(), from, today);
        return fetch;
    }

    /** 이 기업의 공시가 아니거나 접수번호·접수일을 읽을 수 없는 줄은 뺀다. 같은 접수번호는 한 번만 둔다. */
    private static List<Disclosure> toDisclosures(String corpCode, List<DisclosureListResponse.Item> items) {
        Map<String, Disclosure> byRceptNo = new LinkedHashMap<>();
        int skipped = 0;
        for (DisclosureListResponse.Item item : items) {
            LocalDate rceptDt = parseDate(item.rceptDt());
            if (item.rceptNo() == null || item.rceptNo().isBlank() || rceptDt == null || item.reportName() == null
                    || !corpCode.equals(item.corpCode())) {
                skipped++;
                continue;
            }
            byRceptNo.putIfAbsent(item.rceptNo(), new Disclosure(item.rceptNo().trim(), item.reportName().strip(),
                    blankToNull(item.filerName()), rceptDt, blankToNull(item.remark())));
        }
        if (skipped > 0) {
            log.info("최근 공시 목록에서 읽을 수 없는 줄 {}건을 뺐습니다: {}", skipped, corpCode);
        }
        return List.copyOf(byRceptNo.values());
    }

    private static LocalDate parseDate(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(value.trim(), DateTimeFormatter.BASIC_ISO_DATE);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
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
    }
}
