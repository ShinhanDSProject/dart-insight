package com.dartinsight.aiserver.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * AI 서버(FastAPI) 연결 설정. application.yml의 app.ai-server.*
 *
 * @param readTimeout   분석 호출(원문 구조화·문장 비교·요약) 응답 대기 시간
 * @param healthTimeout 상태 확인(/internal/health) 응답 대기 시간. 상태 화면이 오래 멈추지 않도록 짧게 둔다
 */
@ConfigurationProperties(prefix = "app.ai-server")
public record AiServerProperties(
        @DefaultValue("http://localhost:8000") String baseUrl,
        @DefaultValue("2s") Duration connectTimeout,
        @DefaultValue("180s") Duration readTimeout,
        @DefaultValue("3s") Duration healthTimeout) {
}
