package com.dartinsight.auth.service;

import com.dartinsight.auth.config.AuthProperties;
import com.dartinsight.common.web.ApiPaths;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;

@Service
public class RefreshCookieService {
    public static final String NAME = "refresh_token";
    private final AuthProperties properties;

    public RefreshCookieService(AuthProperties properties) {
        this.properties = properties;
    }

    public ResponseCookie create(String value) {
        return ResponseCookie.from(NAME, value).httpOnly(true).secure(properties.secureCookie())
                .sameSite("Strict").path(ApiPaths.BASE).maxAge(properties.refreshTokenTtl()).build();
    }

    public ResponseCookie clear() {
        return ResponseCookie.from(NAME, "").httpOnly(true).secure(properties.secureCookie())
                .sameSite("Strict").path(ApiPaths.BASE).maxAge(0).build();
    }
}
