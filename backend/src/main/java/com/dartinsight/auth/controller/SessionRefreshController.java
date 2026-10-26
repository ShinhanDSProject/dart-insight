package com.dartinsight.auth.controller;

import com.dartinsight.auth.dto.SessionResponse;
import com.dartinsight.auth.service.AuthService;
import com.dartinsight.auth.service.RefreshCookieService;
import com.dartinsight.common.web.ApiPaths;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(ApiPaths.SESSION_REFRESHES)
@RequiredArgsConstructor
public class SessionRefreshController {
    private final AuthService authService;
    private final RefreshCookieService cookies;

    @PostMapping
    public ResponseEntity<SessionResponse> refresh(
            @CookieValue(name = RefreshCookieService.NAME, required = false) String refreshToken) {
        AuthService.IssuedSession issued = authService.refresh(refreshToken);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookies.create(issued.refreshToken()).toString())
                .body(issued.response());
    }
}
