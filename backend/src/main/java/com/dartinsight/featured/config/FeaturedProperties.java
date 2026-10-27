package com.dartinsight.featured.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * 첫 화면 대표 기업 설정. application.yml의 app.featured.* (ADR-0033)
 *
 * @param sync         시작할 때와 하루마다 오래됐으면 받을지(on-stale) 받지 않을지(never)
 * @param refreshAfter 받은 지 이만큼 지나면 다시 받는다
 * @param limit        저장할 기업 수
 */
@ConfigurationProperties(prefix = "app.featured")
public record FeaturedProperties(
        @DefaultValue("on-stale") Sync sync,
        @DefaultValue("30d") Duration refreshAfter,
        @DefaultValue("100") int limit) {

    public enum Sync {
        ON_STALE, NEVER
    }
}
