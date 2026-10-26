package com.dartinsight.auth.controller;

import com.dartinsight.auth.dto.CurrentSessionResponse;
import com.dartinsight.auth.dto.SessionRequest;
import com.dartinsight.auth.dto.SessionResponse;
import com.dartinsight.auth.service.AuthService;
import com.dartinsight.auth.service.RefreshCookieService;
import com.dartinsight.common.web.ApiPaths;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(ApiPaths.SESSIONS)
@RequiredArgsConstructor
public class SessionController {
    private final AuthService authService;
    private final RefreshCookieService cookies;

    @PostMapping
    public ResponseEntity<SessionResponse> login(@RequestBody SessionRequest request) {
        return session(authService.login(request.email(), request.password()));
    }

    @DeleteMapping(ApiPaths.CURRENT)
    public ResponseEntity<Void> logout(
            @CookieValue(name = RefreshCookieService.NAME, required = false) String refreshToken) {
        authService.logout(refreshToken);
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, cookies.clear().toString()).build();
    }

    @GetMapping(ApiPaths.CURRENT)
    public CurrentSessionResponse current(@AuthenticationPrincipal Jwt jwt) {
        return new CurrentSessionResponse(Long.parseLong(jwt.getSubject()));
    }

    private ResponseEntity<SessionResponse> session(AuthService.IssuedSession issued) {
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, cookies.create(issued.refreshToken()).toString())
                .body(issued.response());
    }
}
