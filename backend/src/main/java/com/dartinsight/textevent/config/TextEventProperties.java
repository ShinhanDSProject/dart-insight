package com.dartinsight.textevent.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * 주요 사건 설정(ADR-0050). application.yml의 app.text-events.*
 *
 * @param enabled 7.7 검증을 통과하기 전에는 꺼 둔다. 꺼 두면 실행 없이 NOT_CREATED(DISABLED)로 답한다
 */
@ConfigurationProperties(prefix = "app.text-events")
public record TextEventProperties(@DefaultValue("false") boolean enabled) {
}
