package com.dartinsight.disclosure.service;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.company.service.CompanyService;
import com.dartinsight.dart.client.OpenDartClient;
import com.dartinsight.dart.client.OpenDartPaths;
import com.dartinsight.dart.domain.CachePolicy;
import com.dartinsight.dart.service.DartCacheLoader;
import com.dartinsight.disclosure.domain.Disclosure;
import com.dartinsight.disclosure.domain.DisclosureKeyItems;
import com.dartinsight.disclosure.domain.KeyItem;
import com.dartinsight.disclosure.domain.KeyItemKind;
import com.dartinsight.disclosure.domain.KeyItemRules;
import com.dartinsight.disclosure.domain.KeyItemStatus;
import com.dartinsight.disclosure.repository.DisclosureKeyItemStore;
import com.dartinsight.disclosure.repository.DisclosureStore;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * 주요사항보고서 핵심 수치(FS-51, #363). 최근 공시 목록에 있는 공시 한 건을 OpenDART 주요사항보고서 주요정보(DS005)로
 * 받아 원문 값 그대로 돌려준다. 공시에 딸린 자료라 접수번호마다 한 번만 받는다(ADR-0024 permanent, DartCacheLoader).
 */
@Service
@RequiredArgsConstructor
public class DisclosureKeyItemService {

    private static final Logger log = LoggerFactory.getLogger(DisclosureKeyItemService.class);
    /** DS005 API가 정보를 주는 첫날(개발가이드: 2015년 이후부터 정보제공) */
    static final LocalDate FIRST_AVAILABLE = LocalDate.of(2015, 1, 1);

    private final CompanyService companyService;
    private final DisclosureStore disclosureStore;
    private final DisclosureKeyItemStore keyItemStore;
    private final OpenDartClient openDartClient;
    private final DartCacheLoader cacheLoader;

    public DisclosureKeyItems get(String corpCode, String rceptNo) {
        companyService.get(corpCode);
        Disclosure disclosure = disclosureStore.find(corpCode, rceptNo)
                .orElseThrow(() -> new ApiException(ErrorCode.COMPANY_DISCLOSURE_NOT_FOUND));
        KeyItemKind kind = disclosure.keyItemsKind()
                .orElseThrow(() -> new ApiException(ErrorCode.COMPANY_DISCLOSURE_NOT_FOUND));

        return cacheLoader.load("주요사항보고서 핵심 수치 " + rceptNo, CachePolicy.permanent(),
                () -> keyItemStore.find(rceptNo),
                DisclosureKeyItems::fetchedAt,
                () -> fetch(corpCode, disclosure, kind),
                (items, now) -> save(rceptNo, kind, items, now)).value();
    }

    /**
     * 트랜잭션 밖. DS005 API는 최초접수일 기간으로 거르고 행에는 마지막 정정본의 접수번호를 준다. 원본은 접수일 하루만,
     * [기재정정]은 최초 공시일을 몰라 API가 정보를 주는 첫날부터 접수일까지 부른다. 같은 접수번호의 행만 쓴다.
     *
     * @return 항목 목록. 013이거나 같은 접수번호의 행이 없으면 빈 Optional(자료 없음)
     */
    private Optional<List<KeyItem>> fetch(String corpCode, Disclosure disclosure, KeyItemKind kind) {
        LocalDate end = disclosure.rceptDt();
        LocalDate begin = KeyItemRules.corrected(disclosure.reportName()) ? FIRST_AVAILABLE : end;
        Optional<Map<String, String>> row = openDartClient.majorReportRows(path(kind), corpCode, begin, end)
                .flatMap(rows -> rows.stream()
                        .filter(r -> disclosure.rceptNo().equals(r.get("rcept_no")))
                        .findFirst());
        if (row.isEmpty()) {
            log.info("주요사항보고서 핵심 수치 자료 없음 {} ({})", disclosure.rceptNo(), kind);
        }
        return row.map(kind::items);
    }

    private DisclosureKeyItems save(String rceptNo, KeyItemKind kind, Optional<List<KeyItem>> items,
            LocalDateTime now) {
        DisclosureKeyItems keyItems = new DisclosureKeyItems(rceptNo, kind,
                items.isPresent() ? KeyItemStatus.AVAILABLE : KeyItemStatus.NO_DATA, items.orElse(List.of()), now);
        keyItemStore.save(keyItems);
        return keyItems;
    }

    private static String path(KeyItemKind kind) {
        return switch (kind) {
            case CAPITAL_INCREASE -> OpenDartPaths.CAPITAL_INCREASE_DECISION;
            case CONVERTIBLE_BOND -> OpenDartPaths.CONVERTIBLE_BOND_DECISION;
            case BOND_WITH_WARRANT -> OpenDartPaths.BOND_WITH_WARRANT_DECISION;
            case EXCHANGEABLE_BOND -> OpenDartPaths.EXCHANGEABLE_BOND_DECISION;
            case TREASURY_STOCK_ACQUISITION -> OpenDartPaths.TREASURY_STOCK_ACQUISITION_DECISION;
            case TREASURY_STOCK_DISPOSAL -> OpenDartPaths.TREASURY_STOCK_DISPOSAL_DECISION;
        };
    }
}
