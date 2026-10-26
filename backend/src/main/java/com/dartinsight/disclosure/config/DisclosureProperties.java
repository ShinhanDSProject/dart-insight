package com.dartinsight.disclosure.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * 최근 공시 목록 설정. application.yml의 app.disclosures.*
 *
 * @param refreshAfter 받은 목록을 이 시간이 지나면 OpenDART에서 다시 받는다(ADR-0024)
 */
@ConfigurationProperties(prefix = "app.disclosures")
public record DisclosureProperties(@DefaultValue("1h") Duration refreshAfter) {
}
