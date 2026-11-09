package com.dartinsight.glossary.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.core.io.Resource;

/**
 * 공시 용어 카드 설정. application.yml의 app.glossary.* (ADR-0061)
 *
 * @param location 카드 파일 위치. 카드는 이 파일 한 곳에만 둔다
 */
@ConfigurationProperties(prefix = "app.glossary")
public record GlossaryProperties(@DefaultValue("classpath:glossary/terms.json") Resource location) {
}
