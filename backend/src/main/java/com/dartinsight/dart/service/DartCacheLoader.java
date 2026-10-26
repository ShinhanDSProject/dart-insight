package com.dartinsight.dart.service;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.dart.domain.CachePolicy;
import com.dartinsight.dart.domain.CacheResult;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.function.BiFunction;
import java.util.function.Function;
import java.util.function.Predicate;
import java.util.function.Supplier;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionOperations;

/**
 * OpenDART 자료를 저장해 두고 정책(CachePolicy)에 따라 다시 받는 공통 순서(ADR-0024).
 * <ol>
 *   <li>저장된 값이 유효하면 그대로 돌려준다(OpenDART를 부르지 않음).</li>
 *   <li>아니면 트랜잭션 밖에서 받고(LY-2), 받은 값만 트랜잭션 안에서 저장한다.</li>
 *   <li>받다 실패하면(ApiException) 저장된 값이 있으면 그 값과 실패 코드를 돌려주고, 없으면 그 에러를 그대로 던진다.</li>
 * </ol>
 * 013(자료 없음)은 실패가 아니므로 fetch가 빈 결과(예: Optional.empty())를 돌려주고 save가 '자료 없음'으로 저장한다.
 */
@Service
@RequiredArgsConstructor
public class DartCacheLoader {

    private static final Logger log = LoggerFactory.getLogger(DartCacheLoader.class);

    private final Clock clock;
    private final TransactionOperations transactionOperations;

    /**
     * @param what       로그에 남길 자료 이름(예: "기업개황 00126380"). 키·원문을 넣지 않는다
     * @param findCached 저장된 값 찾기
     * @param fetchedAt  저장된 값의 받은 시각
     * @param fetch      OpenDART 호출(트랜잭션 밖)
     * @param save       받은 값과 지금 시각으로 저장하고 저장한 값을 돌려준다(트랜잭션 안). 같은 키를 동시에 처음
     *                   저장해 UNIQUE에 걸리면 한 번 더 부르므로, 있는 행은 찾아 고치고 없으면 넣어야 한다
     */
    public <T, F> CacheResult<T> load(String what, CachePolicy policy, Supplier<Optional<T>> findCached,
            Function<T, LocalDateTime> fetchedAt, Supplier<F> fetch, BiFunction<F, LocalDateTime, T> save) {
        return load(what, policy, findCached, fetchedAt, cached -> true, fetch, save);
    }

    /**
     * 유효 시간 말고도 저장된 값을 그대로 쓸 조건이 있을 때. 예: 받은 기간이 요청 기간을 덮는지(최근 공시),
     * '자료 없음'을 받은 뒤 보고서 목록에서 그 보고서를 다시 봤는지(정기보고서 주요정보).
     * 조건에 맞지 않아 다시 받다 실패해도 저장된 값과 실패 코드를 돌려준다(stale).
     *
     * @param usable 유효 시간 안의 저장된 값을 그대로 써도 되는지. false면 다시 받는다
     */
    public <T, F> CacheResult<T> load(String what, CachePolicy policy, Supplier<Optional<T>> findCached,
            Function<T, LocalDateTime> fetchedAt, Predicate<T> usable, Supplier<F> fetch,
            BiFunction<F, LocalDateTime, T> save) {
        // DB(DATETIME(6))에 저장되는 정밀도에 맞춘다
        LocalDateTime now = LocalDateTime.now(clock).truncatedTo(ChronoUnit.MICROS);
        Optional<T> cached = findCached.get();
        if (cached.isPresent() && policy.isFresh(fetchedAt.apply(cached.get()), now) && usable.test(cached.get())) {
            return CacheResult.cached(cached.get());
        }

        F fetched;
        try {
            fetched = fetch.get();
        } catch (ApiException e) {
            if (cached.isPresent()) {
                log.warn("{}을(를) 다시 받지 못해 저장된 값을 씁니다: {}", what, e.errorCode());
                return CacheResult.stale(cached.get(), e.errorCode());
            }
            throw e;
        }
        try {
            return CacheResult.fetched(transactionOperations.execute(status -> save.apply(fetched, now)));
        } catch (DataIntegrityViolationException e) {
            log.info("{}을(를) 동시에 저장해 다시 저장합니다", what);
            return CacheResult.fetched(transactionOperations.execute(status -> save.apply(fetched, now)));
        }
    }
}
