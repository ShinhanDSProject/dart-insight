package com.dartinsight.user.domain;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * 회원 한 명의 로그인 방식: 일반 가입 이메일과 연결한 소셜 계정(연결한 순서).
 *
 * @param localEmail 일반 가입 이메일. 일반 가입이 없으면 null
 * @param socialAccounts 연결한 소셜 계정, 먼저 연결한 것부터
 */
public record LoginMethods(String localEmail, List<SocialAccount> socialAccounts) {

    public LoginMethods {
        socialAccounts = List.copyOf(socialAccounts);
    }

    /** 일반 가입이 있는지(local_credential.email은 null이 아니다) */
    public boolean local() {
        return localEmail != null;
    }

    /** LOCAL(일반 가입)과 연결한 소셜 제공자를 LOCAL·GOOGLE·KAKAO·NAVER 순서로 */
    public List<LoginProvider> providers() {
        List<LoginProvider> providers = new ArrayList<>();
        for (LoginProvider provider : LoginProvider.values()) {
            boolean has = provider == LoginProvider.LOCAL ? local()
                    : socialAccounts.stream().anyMatch(a -> LoginProvider.ofSocial(a.getProvider()) == provider);
            if (has) providers.add(provider);
        }
        return providers;
    }

    /** 일반 가입 이메일, 없으면 이메일이 있는 소셜 계정 중 가장 먼저 연결한 것의 이메일을 가린 값. 없으면 null */
    public String maskedEmail() {
        String email = local() ? localEmail : socialAccounts.stream()
                .map(SocialAccount::getEmail)
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(null);
        return EmailMask.mask(email);
    }
}
