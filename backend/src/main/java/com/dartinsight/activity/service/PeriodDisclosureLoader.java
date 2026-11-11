package com.dartinsight.activity.service;

import com.dartinsight.activity.domain.PeriodDisclosure;
import com.dartinsight.activity.domain.PeriodDisclosures;
import com.dartinsight.activity.repository.PeriodDisclosureStore;
import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.dart.client.OpenDartClient;
import com.dartinsight.dart.domain.CachePolicy;
import com.dartinsight.dart.dto.DisclosureListResponse;
import com.dartinsight.dart.service.DartCacheLoader;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 두 보고서 사이에 낸 공시 목록(ADR-0068). 공시유형 B·C·E·I·J의 최종본을 기업·기간마다 한 번 받아 저장한다.
 * 받지 못하면 저장하지 않고 ApiException을 그대로 던진다(다음 요청에서 다시 받음).
 */
@Service
@RequiredArgsConstructor
public class PeriodDisclosureLoader {

    /** 주요사항보고, 발행공시, 기타공시, 거래소공시, 공정위공시(OpenDART 공시검색 pblntf_ty, ADR-0066) */
    private static final List<String> TYPES = List.of("B", "C", "E", "I", "J");
    /** ai-server app/activity/model.py MAX_DISCLOSURES와 같다 */
    static final int MAX_DISCLOSURES = 80;
    private static final Comparator<PeriodDisclosure> BY_DATE =
            Comparator.comparing(PeriodDisclosure::rceptDt).thenComparing(PeriodDisclosure::rceptNo);

    private final OpenDartClient openDartClient;
    private final PeriodDisclosureStore store;
    private final DartCacheLoader cacheLoader;

    /** 기간의 공시를 접수일 순서로. 너무 많으면 최근 것만 남긴다 */
    public List<PeriodDisclosure> load(String corpCode, LocalDate from, LocalDate to) {
        if (from.isAfter(to)) {
            return List.of();
        }
        List<PeriodDisclosure> all = cacheLoader.load("사이 기간 공시 목록 " + corpCode + " " + from + "~" + to,
                CachePolicy.permanent(),
                () -> store.find(corpCode, from, to),
                PeriodDisclosures::fetchedAt,
                () -> fetch(corpCode, from, to),
                (items, now) -> save(corpCode, from, to, items, now)).value().items();
        return all.subList(Math.max(0, all.size() - MAX_DISCLOSURES), all.size());
    }

    private List<PeriodDisclosure> fetch(String corpCode, LocalDate from, LocalDate to) {
        Map<String, PeriodDisclosure> byRceptNo = new LinkedHashMap<>();
        int received = 0;
        for (String type : TYPES) {
            List<DisclosureListResponse.Item> items = openDartClient.listLatestByType(corpCode, from, to, type);
            received += items.size();
            for (DisclosureListResponse.Item item : items) {
                toDisclosure(corpCode, type, item).ifPresent(d -> byRceptNo.putIfAbsent(d.rceptNo(), d));
            }
        }
        if (received > 0 && byRceptNo.isEmpty()) {
            throw new ApiException(ErrorCode.DART_REQUEST_FAILED, "공시 목록을 읽을 수 없습니다.");
        }
        return byRceptNo.values().stream().sorted(BY_DATE).toList();
    }

    private PeriodDisclosures save(String corpCode, LocalDate from, LocalDate to, List<PeriodDisclosure> items,
            LocalDateTime now) {
        Optional<PeriodDisclosures> saved = store.find(corpCode, from, to);
        if (saved.isPresent()) {
            return saved.get();
        }
        store.insert(corpCode, from, to, items, now);
        return new PeriodDisclosures(now, items);
    }

    /** 이 기업의 공시가 아니거나 접수번호·접수일·보고서명을 읽을 수 없으면 빈 값 */
    private static Optional<PeriodDisclosure> toDisclosure(String corpCode, String type,
            DisclosureListResponse.Item item) {
        Optional<LocalDate> rceptDt = parseDate(item.rceptDt());
        if (item.rceptNo() == null || item.rceptNo().isBlank() || rceptDt.isEmpty() || item.reportName() == null
                || item.reportName().isBlank() || !corpCode.equals(item.corpCode())) {
            return Optional.empty();
        }
        return Optional.of(new PeriodDisclosure(item.rceptNo().trim(), type, item.reportName().strip(),
                blankToNull(item.filerName()), rceptDt.get(), blankToNull(item.remark())));
    }

    private static Optional<LocalDate> parseDate(String value) {
        if (value == null || value.isBlank()) {
            return Optional.empty();
        }
        try {
            return Optional.of(LocalDate.parse(value.trim(), DateTimeFormatter.BASIC_ISO_DATE));
        } catch (DateTimeParseException e) {
            return Optional.empty();
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
