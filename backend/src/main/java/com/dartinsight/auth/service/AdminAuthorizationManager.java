package com.dartinsight.auth.service;

import com.dartinsight.user.service.UserService;
import java.util.function.Supplier;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.authorization.AuthorizationManager;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.web.access.intercept.RequestAuthorizationContext;
import org.springframework.stereotype.Component;

/**
 * 관리자 API(/api/admin/**)의 권한 확인(ADR-0040). 역할은 JWT에 넣지 않고 요청마다 app_user.role을 읽는다.
 * 관리자 판단은 이곳에서만 한다. 로그인하지 않았으면 401, 관리자가 아니면 403이 된다(SecurityConfig).
 */
@Component
@RequiredArgsConstructor
public class AdminAuthorizationManager implements AuthorizationManager<RequestAuthorizationContext> {
    private final UserService users;

    @Override
    public AuthorizationDecision authorize(Supplier<? extends Authentication> authentication,
            RequestAuthorizationContext context) {
        if (!(authentication.get() instanceof JwtAuthenticationToken token)) return new AuthorizationDecision(false);
        return new AuthorizationDecision(users.isAdmin(Long.parseLong(token.getToken().getSubject())));
    }
}
