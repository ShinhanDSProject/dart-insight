package com.dartinsight.auth.service;

import com.dartinsight.auth.config.AuthProperties;
import com.dartinsight.auth.domain.AdminEmails;
import com.dartinsight.auth.domain.OpaqueTokens;
import com.dartinsight.auth.domain.RefreshToken;
import com.dartinsight.auth.dto.SessionResponse;
import com.dartinsight.auth.repository.RefreshTokenRepository;
import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.user.service.CredentialAuthenticationService;
import com.dartinsight.user.service.SocialAuthenticationService;
import com.dartinsight.user.service.UserService;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

@Service
@RequiredArgsConstructor
public class AuthService {
    private static final Logger log = LoggerFactory.getLogger(AuthService.class);
    private final CredentialAuthenticationService credentials;
    private final SocialIdentityExtractor identities;
    private final SocialAuthenticationService socialAuthentication;
    private final UserService users;
    private final RefreshTokenRepository refreshTokens;
    private final JwtService jwt;
    private final AuthProperties properties;
    private final TransactionTemplate transactions;
    private final Clock clock;

    @Transactional
    public IssuedSession login(Object email, Object password) {
        var user = credentials.authenticate(email, password);
        grantAdminIfListed(user.userId());
        return issue(user.userId(), UUID.randomUUID().toString());
    }

    /**
     * 제공자가 준 사용자 정보로 회원을 찾거나 만든 뒤 세션을 연다. 회원 저장과 토큰 발급은 따로 커밋한다.
     * 제공자 사용자 ID가 없거나 지원하지 않는 제공자면 IllegalArgumentException
     */
    public IssuedSession loginSocial(String provider, Map<String, Object> attributes) {
        long userId = socialAuthentication.authenticate(identities.extract(provider, attributes));
        return transactions.execute(status -> {
            grantAdminIfListed(userId);
            return issue(userId, UUID.randomUUID().toString());
        });
    }

    @Transactional(noRollbackFor = ApiException.class)
    public IssuedSession refresh(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) throw invalidRefresh();
        LocalDateTime now = LocalDateTime.now(clock);
        RefreshToken current = refreshTokens.findForUpdate(OpaqueTokens.hash(rawToken)).orElseThrow(this::invalidRefresh);
        if (!current.isActive(now)) {
            if (current.wasRevoked()) refreshTokens.revokeFamily(current.familyId(), now);
            throw invalidRefresh();
        }
        IssuedSession replacement = issue(current.userId(), current.familyId());
        current.rotate(now, replacement.refreshTokenId());
        return replacement;
    }

    @Transactional
    public void logout(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) return;
        refreshTokens.findForUpdate(OpaqueTokens.hash(rawToken)).ifPresent(token -> token.revoke(LocalDateTime.now(clock)));
    }

    /**
     * 소유가 확인된 이메일이 ADMIN_EMAILS에 있으면 관리자로 올린다(ADR-0040). 내리지는 않는다.
     * 로그에는 이메일 없이 사용자 ID만 남긴다.
     */
    private void grantAdminIfListed(long userId) {
        AdminEmails adminEmails = AdminEmails.of(properties.adminEmails());
        if (adminEmails.emails().isEmpty() || !adminEmails.containsAny(users.verifiedEmails(userId))) return;
        if (users.grantAdmin(userId)) log.info("Granted admin role: userId={}", userId);
    }

    private IssuedSession issue(long userId, String familyId) {
        LocalDateTime now = LocalDateTime.now(clock);
        String rawRefresh = OpaqueTokens.newToken();
        RefreshToken stored = refreshTokens.saveAndFlush(RefreshToken.create(userId, OpaqueTokens.hash(rawRefresh), familyId,
                now, now.plus(properties.refreshTokenTtl())));
        SessionResponse response = new SessionResponse(userId, jwt.issue(userId), jwt.expiresInSeconds());
        return new IssuedSession(response, rawRefresh, stored.id());
    }

    private ApiException invalidRefresh() { return new ApiException(ErrorCode.AUTH_INVALID_REFRESH_TOKEN); }

    public record IssuedSession(SessionResponse response, String refreshToken, long refreshTokenId) {}
}
