package com.dartinsight.favorite.domain;

import java.util.List;

/**
 * 지금 전체 관심 기업 집계(관리자 개요, 모니터링 수요).
 *
 * @param favorites 관심 기업 행 수
 * @param companies 서로 다른 기업 수
 * @param topWatched 많이 담은 기업(수 많은 순, 같으면 고유번호 순)
 */
public record WatchStats(long favorites, long companies, List<WatchedCompany> topWatched) {

    public WatchStats {
        topWatched = List.copyOf(topWatched);
    }

    /** @param corpName 기업 표에 없으면 null */
    public record WatchedCompany(String corpCode, String corpName, long count) {
    }
}
