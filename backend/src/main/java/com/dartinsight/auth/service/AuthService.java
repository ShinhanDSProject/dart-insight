package com.dartinsight.auth.service;

import com.dartinsight.auth.config.AuthProperties;
import com.dartinsight.auth.domain.RefreshToken;
import com.dartinsight.auth.dto.SessionResponse;
import com.dartinsight.auth.repository.RefreshTokenRepository;
import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.user.service.CredentialAuthenticationService;
import com.dartinsight.user.service.SocialAuthenticationService;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

@Service
@RequiredArgsConstructor
public class AuthService {
    private final CredentialAuthenticationService credentials;
    private final SocialIdentityExtractor identities;
    private final SocialAuthenticationService socialAuthentication;
    private final RefreshTokenRepository refreshTokens;
    private final JwtService jwt;
    private final AuthProperties properties;
    private final TransactionTemplate transactions;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();

    @Transactional
    public IssuedSession login(Object email, Object password) {
        var user = credentials.authenticate(email, password);
        return issue(user.userId(), UUID.randomUUID().toString());
    }

    /**
     * 제공자가 준 사용자 정보로 회원을 찾거나 만든 뒤 세션을 연다. 회원 저장과 토큰 발급은 따로 커밋한다.
     * 제공자 사용자 ID가 없거나 지원하지 않는 제공자면 IllegalArgumentException
     */
    public IssuedSession loginSocial(String provider, Map<String, Object> attributes) {
        long userId = socialAuthentication.authenticate(identities.extract(provider, attributes));
        return transactions.execute(status -> issue(userId, UUID.randomUUID().toString()));
    }

    @Transactional(noRollbackFor = ApiException.class)
    public IssuedSession refresh(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) throw invalidRefresh();
        LocalDateTime now = LocalDateTime.now(clock);
        RefreshToken current = refreshTokens.findForUpdate(hash(rawToken)).orElseThrow(this::invalidRefresh);
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
        refreshTokens.findForUpdate(hash(rawToken)).ifPresent(token -> token.revoke(LocalDateTime.now(clock)));
    }

    private IssuedSession issue(long userId, String familyId) {
        LocalDateTime now = LocalDateTime.now(clock);
        String rawRefresh = randomToken();
        RefreshToken stored = refreshTokens.saveAndFlush(RefreshToken.create(userId, hash(rawRefresh), familyId,
                now, now.plus(properties.refreshTokenTtl())));
        SessionResponse response = new SessionResponse(userId, jwt.issue(userId), jwt.expiresInSeconds());
        return new IssuedSession(response, rawRefresh, stored.id());
    }

    private String randomToken() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.US_ASCII));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }

    private ApiException invalidRefresh() { return new ApiException(ErrorCode.AUTH_INVALID_REFRESH_TOKEN); }

    public record IssuedSession(SessionResponse response, String refreshToken, long refreshTokenId) {}
}
