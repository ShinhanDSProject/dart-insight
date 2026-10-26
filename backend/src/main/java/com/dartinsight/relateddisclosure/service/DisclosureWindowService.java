package com.dartinsight.relateddisclosure.service;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.dart.client.OpenDartClient;
import com.dartinsight.dart.domain.CachePolicy;
import com.dartinsight.dart.dto.DisclosureListResponse;
import com.dartinsight.dart.service.DartCacheLoader;
import com.dartinsight.relateddisclosure.domain.DisclosureDetailType;
import com.dartinsight.relateddisclosure.domain.DisclosureWindow;
import com.dartinsight.relateddisclosure.domain.WindowDisclosure;
import com.dartinsight.relateddisclosure.domain.WindowDisclosures;
import com.dartinsight.relateddisclosure.domain.WindowFetch;
import com.dartinsight.relateddisclosure.domain.WindowFetchStatus;
import com.dartinsight.relateddisclosure.repository.DisclosureWindowStore;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * 관련 수시공시(3.6)의 기간 공시 목록(ADR-0030). 분석 기간마다 공시검색을 상세유형 B001·I001·I002, 정정 전 원본까지
 * 한 번 받아 저장하고, 같은 기업·기간은 다시 부르지 않는다(지난 기간이라 CachePolicy.permanent()). OpenDART 호출은
 * 트랜잭션 밖에서 하고 저장만 DartCacheLoader가 묶는다(LY-2).
 *
 * <p>받지 못하면(020·800·연결 실패·키 없음) 저장하지 않고 ApiException을 그대로 던진다. 부르는 쪽이 '일시 미제공'으로 답한다.
 * '자료 없음'(NO_DATA)은 세 상세유형 모두 받은 줄이 없을 때만 저장한다. 줄을 받았는데 모두 읽을 수 없으면 '자료 없음'으로
 * 굳히지 않고 실패로 본다.
 */
@Service
@RequiredArgsConstructor
public class DisclosureWindowService {

    private static final Logger log = LoggerFactory.getLogger(DisclosureWindowService.class);
    private static final Comparator<WindowDisclosure> BY_DATE =
            Comparator.comparing(WindowDisclosure::rceptDt).thenComparing(WindowDisclosure::rceptNo);

    private final OpenDartClient openDartClient;
    private final DisclosureWindowStore store;
    private final DartCacheLoader cacheLoader;

    /** 기간의 공시 목록. 저장돼 있으면 OpenDART를 부르지 않는다. */
    public WindowDisclosures load(DisclosureWindow window) {
        return cacheLoader.load("관련 수시공시 목록 " + window.corpCode() + " " + window.from() + "~" + window.to(),
                CachePolicy.permanent(),
                () -> findSaved(window),
                saved -> saved.fetch().fetchedAt(),
                () -> fetch(window),
                (items, now) -> save(window, items, now)).value();
    }

    private Optional<WindowDisclosures> findSaved(DisclosureWindow window) {
        return store.findFetch(window.corpCode(), window.from(), window.to())
                .map(fetch -> new WindowDisclosures(fetch, store.findItems(fetch.id())));
    }

    /**
     * 트랜잭션 밖. 상세유형마다 한 번씩 부른다. 하나라도 실패하면 아무것도 저장하지 않는다. 받은 줄이 있는데 이 기업의 공시로
     * 읽을 수 있는 줄이 하나도 없으면 DART_REQUEST_FAILED로 실패한다(다음 요청에서 다시 받음).
     */
    private List<WindowDisclosure> fetch(DisclosureWindow window) {
        Map<String, WindowDisclosure> byRceptNo = new LinkedHashMap<>();
        int received = 0;
        int skipped = 0;
        for (DisclosureDetailType type : DisclosureDetailType.values()) {
            List<DisclosureListResponse.Item> items = openDartClient.listDisclosuresWithOriginals(window.corpCode(),
                    window.from(), window.to(), type.name());
            received += items.size();
            for (DisclosureListResponse.Item item : items) {
                WindowDisclosure disclosure = toDisclosure(window.corpCode(), type, item);
                if (disclosure == null) {
                    skipped++;
                    continue;
                }
                byRceptNo.putIfAbsent(disclosure.rceptNo(), disclosure);
            }
        }
        if (received > 0 && byRceptNo.isEmpty()) {
            log.warn("관련 수시공시 목록을 {}줄 받았지만 읽을 수 있는 줄이 없습니다: {}", received, window.corpCode());
            throw new ApiException(ErrorCode.DART_REQUEST_FAILED, "공시 목록을 읽을 수 없습니다.");
        }
        if (skipped > 0) {
            log.info("관련 수시공시 목록에서 읽을 수 없는 줄 {}건을 뺐습니다: {}", skipped, window.corpCode());
        }
        List<WindowDisclosure> sorted = new ArrayList<>(byRceptNo.values());
        sorted.sort(BY_DATE);
        return sorted;
    }

    /**
     * 트랜잭션 안. 같은 기업·기간을 동시에 처음 받아 UNIQUE에 걸리면 DartCacheLoader가 한 번 더 부르므로, 그때는 먼저
     * 저장된 것을 돌려준다.
     */
    private WindowDisclosures save(DisclosureWindow window, List<WindowDisclosure> items, LocalDateTime now) {
        Optional<WindowDisclosures> saved = findSaved(window);
        if (saved.isPresent()) {
            return saved.get();
        }
        WindowFetchStatus status = items.isEmpty() ? WindowFetchStatus.NO_DATA : WindowFetchStatus.OK;
        WindowFetch fetch = new WindowFetch(null, window.corpCode(), window.from(), window.to(), status, now);
        long id = store.insert(fetch, items);
        log.info("관련 수시공시 목록 저장 {}: {}건 ({} ~ {})", window.corpCode(), items.size(), window.from(),
                window.to());
        return new WindowDisclosures(new WindowFetch(id, fetch.corpCode(), fetch.beginDate(), fetch.endDate(),
                fetch.status(), fetch.fetchedAt()), store.findItems(id));
    }

    /** 이 기업의 공시가 아니거나 접수번호·접수일·보고서명을 읽을 수 없으면 null */
    private static WindowDisclosure toDisclosure(String corpCode, DisclosureDetailType type,
            DisclosureListResponse.Item item) {
        LocalDate rceptDt = parseDate(item.rceptDt());
        if (item.rceptNo() == null || item.rceptNo().isBlank() || rceptDt == null || item.reportName() == null
                || item.reportName().isBlank() || !corpCode.equals(item.corpCode())) {
            return null;
        }
        return new WindowDisclosure(null, item.rceptNo().trim(), type, item.reportName().strip(),
                blankToNull(item.filerName()), rceptDt, blankToNull(item.remark()));
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
}
