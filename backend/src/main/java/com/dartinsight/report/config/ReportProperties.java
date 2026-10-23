package com.dartinsight.report.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * 정기보고서 목록 설정. application.yml의 app.reports.*
 *
 * @param refreshAfter  저장한 목록을 이 시간이 지나면 OpenDART에서 다시 받는다
 * @param listStartYear 이 해 1월 1일 이후 접수된 보고서만 받는다(재무제표 API가 2015년 이후만 제공)
 */
@ConfigurationProperties(prefix = "app.reports")
public record ReportProperties(
        @DefaultValue("24h") Duration refreshAfter,
        @DefaultValue("2015") int listStartYear) {
}
