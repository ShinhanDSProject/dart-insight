package com.dartinsight.auth.dto;

import com.dartinsight.user.domain.UserProfile;

/** 화면이 닉네임 정하기·관리자 메뉴를 보일지 정하는 데 쓴다. 권한은 서버가 관리자 API마다 다시 확인한다(ADR-0040). */
public record CurrentSessionResponse(long userId, String nickname, boolean admin) {
    public static CurrentSessionResponse from(UserProfile profile) {
        return new CurrentSessionResponse(profile.userId(), profile.nickname(), profile.admin());
    }
}
