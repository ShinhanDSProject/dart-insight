package com.dartinsight.dart.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.dartinsight.common.config.ClockConfig;
import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.dart.domain.CachePolicy;
import com.dartinsight.dart.domain.CacheResult;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Supplier;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.support.TransactionOperations;

class DartCacheLoaderTest {

    private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 26, 10, 0);
    private static final CachePolicy WEEK = CachePolicy.refreshAfter(Duration.ofDays(7));

    private final DartCacheLoader loader = new DartCacheLoader(
            Clock.fixed(NOW.atZone(ClockConfig.SEOUL).toInstant(), ClockConfig.SEOUL),
            TransactionOperations.withoutTransaction());

    /** 저장된 값: 받은 시각과 내용 */
    private record Row(LocalDateTime fetchedAt, String value) {
    }

    private final AtomicInteger fetches = new AtomicInteger();

    private Supplier<String> fetchReturning(String value) {
        return () -> {
            fetches.incrementAndGet();
            return value;
        };
    }

    private Supplier<String> fetchFailing(ErrorCode code) {
        return () -> {
            fetches.incrementAndGet();
            throw new ApiException(code);
        };
    }

    private CacheResult<Row> load(CachePolicy policy, Row cached, Supplier<String> fetch) {
        return loader.load("테스트 자료", policy, () -> Optional.ofNullable(cached), Row::fetchedAt, fetch,
                (value, now) -> new Row(now, value));
    }

    @Test
    @DisplayName("유효 시간 안의 저장된 값은 OpenDART를 부르지 않고 그대로 돌려준다")
    void freshCacheIsReturnedWithoutFetching() {
        Row cached = new Row(NOW.minusDays(6), "저장된 값");

        CacheResult<Row> result = load(WEEK, cached, fetchReturning("새 값"));

        assertThat(result).isEqualTo(CacheResult.cached(cached));
        assertThat(fetches).hasValue(0);
    }

    @Test
    @DisplayName("유효 시간이 지나면 다시 받아 지금 시각으로 저장한다")
    void expiredCacheIsRefetched() {
        CacheResult<Row> result = load(WEEK, new Row(NOW.minusDays(7), "저장된 값"), fetchReturning("새 값"));

        assertThat(result.fetched()).isTrue();
        assertThat(result.value()).isEqualTo(new Row(NOW, "새 값"));
        assertThat(result.refreshError()).isNull();
        assertThat(fetches).hasValue(1);
    }

    @Test
    @DisplayName("보고서에 딸린 자료(permanent)는 오래돼도 다시 받지 않는다")
    void permanentCacheIsNeverRefetched() {
        Row cached = new Row(NOW.minusYears(3), "저장된 값");

        CacheResult<Row> result = load(CachePolicy.permanent(), cached, fetchReturning("새 값"));

        assertThat(result.value()).isEqualTo(cached);
        assertThat(fetches).hasValue(0);
    }

    @Test
    @DisplayName("저장된 값이 없으면 받는다")
    void missingCacheIsFetched() {
        CacheResult<Row> result = load(CachePolicy.permanent(), null, fetchReturning("새 값"));

        assertThat(result).isEqualTo(CacheResult.fetched(new Row(NOW, "새 값")));
    }

    @Test
    @DisplayName("다시 받다 실패하면 저장된 값과 실패 코드를 돌려준다")
    void failureFallsBackToStaleCache() {
        Row cached = new Row(NOW.minusDays(10), "저장된 값");

        CacheResult<Row> result = load(WEEK, cached, fetchFailing(ErrorCode.DART_RATE_LIMITED));

        assertThat(result).isEqualTo(CacheResult.stale(cached, ErrorCode.DART_RATE_LIMITED));
    }

    @Test
    @DisplayName("저장된 값이 없는데 받다 실패하면 그 에러를 그대로 던진다")
    void failureWithoutCacheThrows() {
        assertThatThrownBy(() -> load(WEEK, null, fetchFailing(ErrorCode.DART_REQUEST_FAILED)))
                .isInstanceOfSatisfying(ApiException.class,
                        e -> assertThat(e.errorCode()).isEqualTo(ErrorCode.DART_REQUEST_FAILED));
    }

    @Test
    @DisplayName("동시에 처음 저장해 UNIQUE에 걸리면 받은 값으로 한 번 더 저장한다(다시 받지는 않는다)")
    void duplicateInsertIsRetriedOnce() {
        AtomicInteger saves = new AtomicInteger();

        CacheResult<Row> result = loader.load("테스트 자료", WEEK, Optional::<Row>empty, Row::fetchedAt,
                fetchReturning("새 값"), (value, now) -> {
                    if (saves.incrementAndGet() == 1) {
                        throw new DataIntegrityViolationException("uk");
                    }
                    return new Row(now, value);
                });

        assertThat(result.value()).isEqualTo(new Row(NOW, "새 값"));
        assertThat(saves).hasValue(2);
        assertThat(fetches).hasValue(1);
    }
}
