package com.dartinsight.auth.controller;

import com.dartinsight.auth.config.AuthProperties;
import com.dartinsight.auth.service.AuthService;
import com.dartinsight.auth.service.RefreshCookieService;
import com.dartinsight.auth.service.SocialIdentityExtractor;
import com.dartinsight.common.web.ApiPaths;
import com.dartinsight.user.SocialAuthenticationService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.web.WebAttributes;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.UriComponentsBuilder;

@RestController
@RequestMapping(ApiPaths.SOCIAL_SESSIONS)
@RequiredArgsConstructor
public class SocialSessionController {
    private static final Logger log = LoggerFactory.getLogger(SocialSessionController.class);
    private final SocialIdentityExtractor identities;
    private final SocialAuthenticationService socialAuthentication;
    private final AuthService auth;
    private final RefreshCookieService cookies;
    private final AuthProperties properties;

    @GetMapping("/callback")
    public void callback(OAuth2AuthenticationToken token, HttpServletRequest request, HttpServletResponse response)
            throws IOException {
        if (token == null) {
            log.info("Social login callback without OAuth2 authentication");
            redirectFailure(request, response);
            return;
        }
        String provider = token.getAuthorizedClientRegistrationId();
        try {
            var identity = identities.extract(provider, token.getPrincipal().getAttributes());
            long userId = socialAuthentication.authenticate(identity);
            var session = auth.loginSocial(userId);
            response.addHeader(HttpHeaders.SET_COOKIE, cookies.create(session.refreshToken()).toString());
            invalidate(request);
            response.sendRedirect(redirect("success"));
        } catch (IllegalArgumentException exception) {
            log.warn("Social login rejected: provider={}, reason={}", provider, exception.getMessage());
            redirectFailure(request, response);
        } catch (RuntimeException exception) {
            log.error("Social login failed: provider={}", provider, exception);
            redirectFailure(request, response);
        }
    }

    // 제공자 쪽 실패(사용자 취소, 잘못된 state 등). SecurityConfig가 예외를 요청 속성에 담아 forward한다. 예외 종류만 기록한다.
    @GetMapping("/failure")
    public void failure(HttpServletRequest request, HttpServletResponse response) throws IOException {
        Object exception = request.getAttribute(WebAttributes.AUTHENTICATION_EXCEPTION);
        String reason = exception instanceof OAuth2AuthenticationException oauth ? oauth.getError().getErrorCode()
                : exception == null ? "unknown" : exception.getClass().getSimpleName();
        log.warn("Social login failed at provider: reason={}", reason);
        redirectFailure(request, response);
    }

    private void redirectFailure(HttpServletRequest request, HttpServletResponse response) throws IOException {
        invalidate(request);
        response.sendRedirect(redirect("error"));
    }

    private void invalidate(HttpServletRequest request) {
        if (request.getSession(false) != null) request.getSession(false).invalidate();
    }

    private String redirect(String result) {
        return UriComponentsBuilder.fromUriString(properties.socialLoginRedirectUrl())
                .queryParam("social", result).build().toUriString();
    }
}
