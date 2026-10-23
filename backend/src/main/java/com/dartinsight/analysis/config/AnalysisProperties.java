package com.dartinsight.analysis.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * 분석 실행 설정. application.yml의 app.analysis.*
 *
 * @param async 분석을 요청과 다른 스레드에서 돌릴지. 테스트는 false로 요청 안에서 끝까지 돌린다
 */
@ConfigurationProperties(prefix = "app.analysis")
public record AnalysisProperties(@DefaultValue("true") boolean async) {
}
