package com.dartinsight.season.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * 이번 시즌 변화가 큰 기업 설정. application.yml의 app.season-changes.* (ADR-0037)
 *
 * @param enabled   계산할지. 테스트·키 없는 환경에서 끈다
 * @param graceDays 제출 기한에서 이만큼 지나야 그 시즌을 계산한다
 */
@ConfigurationProperties(prefix = "app.season-changes")
public record SeasonChangeProperties(
        @DefaultValue("true") boolean enabled,
        @DefaultValue("7") int graceDays) {
}
