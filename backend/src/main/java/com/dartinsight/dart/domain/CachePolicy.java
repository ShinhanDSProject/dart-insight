package com.dartinsight.dart.domain;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Objects;

/**
 * OpenDART에서 받아 저장한 자료를 언제 다시 받을지(ADR-0024).
 * 보고서에 딸린 자료(접수번호 키)는 {@link #permanent()}, 기업개황·공시 목록처럼 바뀌는 자료는 {@link #refreshAfter(Duration)}.
 *
 * @param refreshAfter 받은 뒤 이 시간이 지나면 다시 받는다. null이면 다시 받지 않는다
 */
public record CachePolicy(Duration refreshAfter) {

    public static CachePolicy permanent() {
        return new CachePolicy(null);
    }

    public static CachePolicy refreshAfter(Duration refreshAfter) {
        Objects.requireNonNull(refreshAfter, "refreshAfter");
        return new CachePolicy(refreshAfter);
    }

    /** 저장된 값을 그대로 써도 되는지. 받은 시각이 없으면 다시 받는다. */
    public boolean isFresh(LocalDateTime fetchedAt, LocalDateTime now) {
        if (fetchedAt == null) {
            return false;
        }
        return refreshAfter == null || fetchedAt.isAfter(now.minus(refreshAfter));
    }
}
