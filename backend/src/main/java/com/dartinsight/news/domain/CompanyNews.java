package com.dartinsight.news.domain;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 한 기업의 뉴스 목록(ADR-0046). backend 메모리에 기업별로 캐시한다.
 *
 * @param query     네이버에 보낸 검색어(기업 이름)
 * @param fetchedAt 네이버에서 받은 시각(한국 시간)
 */
public record CompanyNews(String corpCode, String query, LocalDateTime fetchedAt, List<NewsArticle> items) {

    /** 받은 지 ttl이 지났는지 */
    public boolean expired(LocalDateTime now, Duration ttl) {
        return !fetchedAt.plus(ttl).isAfter(now);
    }
}
