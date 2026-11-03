package com.dartinsight.news.domain;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 기업별 뉴스 메모리 캐시(ADR-0046). 넣을 때마다 받은 지 ttl이 지난 기업을 지워, 최근 ttl 안에 연 기업 수만큼만 남는다.
 */
public class CompanyNewsCache {

    private final Duration ttl;
    private final Map<String, CompanyNews> entries = new ConcurrentHashMap<>();

    public CompanyNewsCache(Duration ttl) {
        this.ttl = ttl;
    }

    /** 받은 지 ttl이 안 지난 그 기업의 뉴스 */
    public Optional<CompanyNews> fresh(String corpCode, LocalDateTime now) {
        return Optional.ofNullable(entries.get(corpCode)).filter(news -> !news.expired(now, ttl));
    }

    public void put(CompanyNews news, LocalDateTime now) {
        entries.values().removeIf(old -> old.expired(now, ttl));
        entries.put(news.corpCode(), news);
    }

    int size() {
        return entries.size();
    }
}
