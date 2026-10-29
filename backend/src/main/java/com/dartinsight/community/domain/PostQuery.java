package com.dartinsight.community.domain;

import com.dartinsight.common.error.ApiException;
import java.util.Locale;

/** 글 목록 조회 조건(GET /api/companies/{corpCode}/posts). 값이 없으면 최신순, 0쪽, 20개. */
public record PostQuery(Sort sort, int page, int size) {
    public static final int DEFAULT_SIZE = 20;
    public static final int MAX_SIZE = 50;

    public enum Sort {
        /** 쓴 시각 역순 */
        LATEST,
        /** 좋아요 수 + 댓글 수가 많은 순, 같으면 최신 */
        POPULAR
    }

    public static PostQuery of(String sort, Integer page, Integer size) {
        return new PostQuery(sort(sort), page(page), size(size));
    }

    public String sortName() {
        return sort.name().toLowerCase(Locale.ROOT);
    }

    private static Sort sort(String raw) {
        if (raw == null || raw.isBlank()) return Sort.LATEST;
        return switch (raw.strip()) {
            case "latest" -> Sort.LATEST;
            case "popular" -> Sort.POPULAR;
            default -> throw ApiException.invalidInput("sort", "latest 또는 popular여야 합니다.");
        };
    }

    private static int page(Integer raw) {
        if (raw == null) return 0;
        if (raw < 0) throw ApiException.invalidInput("page", "0 이상이어야 합니다.");
        return raw;
    }

    private static int size(Integer raw) {
        if (raw == null) return DEFAULT_SIZE;
        if (raw < 1 || raw > MAX_SIZE) throw ApiException.invalidInput("size", "1~50이어야 합니다.");
        return raw;
    }
}
