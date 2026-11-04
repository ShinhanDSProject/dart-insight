package com.dartinsight.user.domain;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 관리자 회원 목록의 회원 한 명. 이메일은 가린 값만 담는다(전체 이메일은 user 도메인 밖으로 내보내지 않음).
 *
 * @param maskedEmail 가린 이메일. 이메일이 없으면 null
 */
public record UserListing(long userId, String nickname, String maskedEmail, List<LoginProvider> providers,
        UserRole role, LocalDateTime createdAt) {

    public UserListing {
        providers = List.copyOf(providers);
    }

    public static UserListing of(User user, LoginMethods methods) {
        return new UserListing(user.getId(), user.getNickname(), methods.maskedEmail(), methods.providers(),
                user.getRole(), user.getCreatedAt());
    }
}
