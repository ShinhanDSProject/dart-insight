package com.dartinsight.auth.domain;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;

/** Refresh Token·비밀번호 재설정 토큰처럼 원문은 사용자에게만 주고 DB에는 해시만 두는 난수 토큰. */
public final class OpaqueTokens {
    private static final SecureRandom RANDOM = new SecureRandom();

    private OpaqueTokens() {}

    /** 32바이트 난수의 base64url(43자) */
    public static String newToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /** 원문의 SHA-256 base64url(43자) */
    public static String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.US_ASCII));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }
}
