package com.dartinsight.company.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * 기업 정보 설정. application.yml의 app.company.*
 *
 * @param overviewRefreshAfter 저장한 기업개황을 이 시간이 지나면 OpenDART에서 다시 받는다(ADR-0024)
 */
@ConfigurationProperties(prefix = "app.company")
public record CompanyProperties(@DefaultValue("7d") Duration overviewRefreshAfter) {
}
