package com.dartinsight.user.domain;

import java.util.Locale;

/** 가입·로그인 방식(관리자 회원 목록·개요). 일반 가입(local_credential)과 소셜 제공자(social_account.provider) */
public enum LoginProvider {
    LOCAL,
    GOOGLE,
    KAKAO,
    NAVER;

    /** social_account.provider(google·kakao·naver) → 값 */
    public static LoginProvider ofSocial(String provider) {
        return valueOf(provider.toUpperCase(Locale.ROOT));
    }
}
