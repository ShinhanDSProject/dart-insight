package com.dartinsight.user.domain;

/** 다른 도메인에 건네는 회원의 공개 정보. 닉네임은 정하지 않았으면 null. */
public record UserProfile(long userId, String nickname, boolean admin) {
    public static UserProfile from(User user) {
        return new UserProfile(user.getId(), user.getNickname(), user.isAdmin());
    }
}
