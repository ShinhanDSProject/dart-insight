package com.dartinsight.common.web;

import com.dartinsight.common.error.ApiException;

/**
 * 목록 API의 page·size 쿼리(0부터, 1~50, 기본 20). 관리자 분석 작업·회원 목록이 쓴다(커뮤니티 PostQuery와 같은 규칙).
 * 범위 밖이면 400 errors[page]·errors[size].
 */
public record PageParams(int page, int size) {
    public static final int DEFAULT_SIZE = 20;
    public static final int MAX_SIZE = 50;

    public static PageParams of(Integer page, Integer size) {
        if (page != null && page < 0) throw ApiException.invalidInput("page", "0 이상이어야 합니다.");
        if (size != null && (size < 1 || size > MAX_SIZE)) {
            throw ApiException.invalidInput("size", "1~50이어야 합니다.");
        }
        return new PageParams(page == null ? 0 : page, size == null ? DEFAULT_SIZE : size);
    }
}
