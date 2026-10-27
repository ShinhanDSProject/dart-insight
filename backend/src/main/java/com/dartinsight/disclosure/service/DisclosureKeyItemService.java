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
import com.dartinsight.disclosure.domain.KeyItemTarget;
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
 * 받기·저장({@link #load})은 관련 수시공시(3.6, ADR-0030)도 함께 쓴다.
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
        return load(corpCode,
                KeyItemTarget.of(rceptNo, disclosure.reportName(), disclosure.rceptDt(), kind, disclosure.remark()));
    }

    /**
     * 공시 한 건의 핵심 수치. 저장돼 있으면 OpenDART를 부르지 않는다. 관련 수시공시(3.6)도 이 메서드로 받는다(ADR-0030).
     * 부르는 쪽이 공시가 그 기업의 것인지와 종류를 정한다.
     *
     * @throws ApiException OpenDART 호출 실패(DART_*, 저장하지 않음)
     */
    public DisclosureKeyItems load(String corpCode, KeyItemTarget target) {
        return cacheLoader.load("주요사항보고서 핵심 수치 " + target.rceptNo(), CachePolicy.permanent(),
                () -> keyItemStore.find(target.rceptNo()),
                DisclosureKeyItems::fetchedAt,
                () -> fetch(corpCode, target),
                (fetched, now) -> save(target, fetched, now)).value();
    }

    /**
     * 트랜잭션 밖. DS005 API는 최초접수일 기간으로 거르고 행에는 마지막 정정본의 접수번호를 준다.
     * <ul>
     *   <li>원본: 접수일 하루만 불러 같은 접수번호의 행을 쓴다</li>
     *   <li>[기재정정]: 최초 공시일을 몰라 API가 정보를 주는 첫날부터 접수일까지 불러 같은 접수번호의 행을 쓴다</li>
     *   <li>정정된 원본({@link KeyItemTarget#correctedLater()}): 원본 접수일 하루로 불러 같은 접수번호의 행이
     *       있으면 그 행, 없고 그 종류의 행이 하나뿐이면 그 행(최신 정정본)을 쓰고 행의 접수번호를 남긴다. 둘 이상이면 어느
     *       것인지 고르지 않는다</li>
     * </ul>
     *
     * @return 받은 행. 013이거나 쓸 행이 없으면 빈 Optional(자료 없음)
     */
    private Optional<Fetched> fetch(String corpCode, KeyItemTarget target) {
        LocalDate end = target.rceptDt();
        LocalDate begin = !target.correctedLater() && KeyItemRules.corrected(target.reportName())
                ? FIRST_AVAILABLE : end;
        List<Map<String, String>> rows = openDartClient.majorReportRows(path(target.kind()), corpCode, begin, end)
                .orElse(List.of());
        Optional<Map<String, String>> row = rows.stream()
                .filter(r -> target.rceptNo().equals(r.get("rcept_no")))
                .findFirst();
        if (row.isEmpty() && target.correctedLater() && rows.size() == 1) {
            row = Optional.of(rows.get(0));
        }
        if (row.isEmpty()) {
            log.info("주요사항보고서 핵심 수치 자료 없음 {} ({}, 행 {}개)", target.rceptNo(), target.kind(), rows.size());
            return Optional.empty();
        }
        String rowRceptNo = row.get().get("rcept_no");
        String source = rowRceptNo == null || rowRceptNo.equals(target.rceptNo()) ? null : rowRceptNo.strip();
        return Optional.of(new Fetched(target.kind().items(row.get()), source));
    }

    private DisclosureKeyItems save(KeyItemTarget target, Optional<Fetched> fetched, LocalDateTime now) {
        DisclosureKeyItems keyItems = new DisclosureKeyItems(target.rceptNo(), target.kind(),
                fetched.isPresent() ? KeyItemStatus.AVAILABLE : KeyItemStatus.NO_DATA,
                fetched.map(Fetched::items).orElse(List.of()), now,
                fetched.map(Fetched::sourceRceptNo).orElse(null));
        keyItemStore.save(keyItems);
        return keyItems;
    }

    /** @param sourceRceptNo 행의 접수번호가 요청한 공시와 다를 때 그 접수번호 */
    private record Fetched(List<KeyItem> items, String sourceRceptNo) {
    }

    private static String path(KeyItemKind kind) {
        return switch (kind) {
            case CAPITAL_INCREASE -> OpenDartPaths.CAPITAL_INCREASE_DECISION;
            case CONVERTIBLE_BOND -> OpenDartPaths.CONVERTIBLE_BOND_DECISION;
            case BOND_WITH_WARRANT -> OpenDartPaths.BOND_WITH_WARRANT_DECISION;
            case EXCHANGEABLE_BOND -> OpenDartPaths.EXCHANGEABLE_BOND_DECISION;
            case TREASURY_STOCK_ACQUISITION -> OpenDartPaths.TREASURY_STOCK_ACQUISITION_DECISION;
            case TREASURY_STOCK_DISPOSAL -> OpenDartPaths.TREASURY_STOCK_DISPOSAL_DECISION;
            case LITIGATION -> OpenDartPaths.LITIGATION;
            case STOCK_ACQUISITION -> OpenDartPaths.STOCK_ACQUISITION_DECISION;
        };
    }
}
