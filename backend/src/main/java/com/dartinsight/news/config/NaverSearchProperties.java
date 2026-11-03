package com.dartinsight.news.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * NAVER API HUB 뉴스 검색 연결 설정. application.yml의 app.naver-search.* (ADR-0046)
 *
 * @param clientId     환경변수 NAVER_SEARCH_CLIENT_ID로만 넣는다(소셜 로그인 키와 다름)
 * @param clientSecret 환경변수 NAVER_SEARCH_CLIENT_SECRET로만 넣는다
 * @param cacheTtl     기업별 뉴스 목록을 메모리에 두는 시간
 */
@ConfigurationProperties(prefix = "app.naver-search")
public record NaverSearchProperties(
        String clientId,
        String clientSecret,
        @DefaultValue("https://naverapihub.apigw.ntruss.com") String baseUrl,
        @DefaultValue("3s") Duration connectTimeout,
        @DefaultValue("10s") Duration readTimeout,
        @DefaultValue("30m") Duration cacheTtl) {

    public boolean hasKeys() {
        return clientId != null && !clientId.isBlank() && clientSecret != null && !clientSecret.isBlank();
    }
}
