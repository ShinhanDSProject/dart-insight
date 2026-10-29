package com.dartinsight.auth.config;

import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

@ConfigurationProperties(prefix = "app.auth")
public record AuthProperties(
        @DefaultValue("dart-insight") String issuer,
        @DefaultValue("development-only-change-me-32-bytes") String jwtSecret,
        @DefaultValue("15m") Duration accessTokenTtl,
        @DefaultValue("14d") Duration refreshTokenTtl,
        @DefaultValue("false") boolean secureCookie,
        @DefaultValue("http://localhost:5173/login") String socialLoginRedirectUrl,
        // 로그인할 때 관리자로 올릴, 소유가 확인된 이메일(ADR-0040). 실제 값은 .env·서버 환경변수에만 둔다
        @DefaultValue("") List<String> adminEmails) {
}
