package com.dartinsight.dart.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * OpenDART 연결 설정. application.yml의 app.opendart.*
 *
 * @param apiKey       인증키. 환경변수 OPENDART_API_KEY로만 넣는다
 * @param maxRetries   네트워크 오류·서버 오류일 때 다시 시도하는 횟수
 * @param corpCodeSync 기업 목록을 시작할 때 받을지
 */
@ConfigurationProperties(prefix = "app.opendart")
public record OpenDartProperties(
        String apiKey,
        @DefaultValue("https://opendart.fss.or.kr") String baseUrl,
        @DefaultValue("5s") Duration connectTimeout,
        @DefaultValue("60s") Duration readTimeout,
        @DefaultValue("2") int maxRetries,
        @DefaultValue("on-empty") CorpCodeSync corpCodeSync) {

    public enum CorpCodeSync {
        ON_EMPTY, ALWAYS, NEVER
    }

    public boolean hasApiKey() {
        return apiKey != null && !apiKey.isBlank();
    }
}
