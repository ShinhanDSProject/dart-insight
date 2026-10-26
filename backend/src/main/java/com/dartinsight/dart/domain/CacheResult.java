package com.dartinsight.dart.domain;

import com.dartinsight.common.error.ErrorCode;

/**
 * 저장된 값 또는 새로 받은 값(ADR-0024).
 *
 * @param fetched      이번 요청에서 OpenDART를 불러 새로 저장했는지
 * @param refreshError 다시 받지 못해 저장된 값을 돌려줄 때 그 이유. 아니면 null
 */
public record CacheResult<T>(T value, boolean fetched, ErrorCode refreshError) {

    public static <T> CacheResult<T> cached(T value) {
        return new CacheResult<>(value, false, null);
    }

    public static <T> CacheResult<T> fetched(T value) {
        return new CacheResult<>(value, true, null);
    }

    public static <T> CacheResult<T> stale(T value, ErrorCode refreshError) {
        return new CacheResult<>(value, false, refreshError);
    }
}
