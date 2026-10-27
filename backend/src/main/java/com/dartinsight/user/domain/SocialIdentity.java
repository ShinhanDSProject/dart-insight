package com.dartinsight.user.domain;

import java.util.Locale;

public record SocialIdentity(String provider, String providerUserId, String email, boolean emailVerified) {

    /** 회원과 연결할 수 있는 신원인지 확인한다. 제공자 사용자 ID가 없거나 지원하지 않는 제공자면 IllegalArgumentException */
    public static void requireValid(SocialIdentity identity) {
        // 이메일은 제공자·동의 여부에 따라 없을 수 있어 확인하지 않는다(연결 키는 provider + providerUserId, ADR-0022).
        if (identity == null || identity.provider() == null
                || identity.providerUserId() == null || identity.providerUserId().isBlank()) {
            throw new IllegalArgumentException("Social provider did not return a user id");
        }
        String provider = identity.provider().toLowerCase(Locale.ROOT);
        if (!provider.equals("google") && !provider.equals("kakao") && !provider.equals("naver")) {
            throw new IllegalArgumentException("Unsupported social provider");
        }
    }
}
