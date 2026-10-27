package com.dartinsight.datagokr.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * 공공데이터포털 연결 설정. application.yml의 app.data-go-kr.* (ADR-0033)
 *
 * @param apiKey 일반 인증키. 환경변수 DATA_GO_KR_API_KEY로만 넣는다. 포털 화면의 인코딩된 모양(%)이어도 된다
 */
@ConfigurationProperties(prefix = "app.data-go-kr")
public record DataGoKrProperties(
        String apiKey,
        @DefaultValue("https://apis.data.go.kr") String baseUrl,
        @DefaultValue("5s") Duration connectTimeout,
        @DefaultValue("30s") Duration readTimeout) {

    public boolean hasApiKey() {
        return apiKey != null && !apiKey.isBlank();
    }
}
