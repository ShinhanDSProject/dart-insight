package com.dartinsight.aiserver;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * AI 서버(FastAPI) 연결 설정. application.yml의 app.ai-server.*
 */
@ConfigurationProperties(prefix = "app.ai-server")
public record AiServerProperties(
        @DefaultValue("http://localhost:8000") String baseUrl,
        @DefaultValue("2s") Duration connectTimeout,
        @DefaultValue("30s") Duration readTimeout) {
}
