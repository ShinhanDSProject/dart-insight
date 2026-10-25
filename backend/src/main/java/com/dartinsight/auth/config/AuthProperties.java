package com.dartinsight.auth.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

@ConfigurationProperties(prefix = "app.auth")
public record AuthProperties(
        @DefaultValue("dart-insight") String issuer,
        @DefaultValue("development-only-change-me-32-bytes") String jwtSecret,
        @DefaultValue("15m") Duration accessTokenTtl,
        @DefaultValue("14d") Duration refreshTokenTtl,
        @DefaultValue("false") boolean secureCookie,
        @DefaultValue("http://localhost:5173/login") String socialLoginRedirectUrl) {
}
