package com.dartinsight.user.domain;

import com.dartinsight.common.error.ApiException;
import java.util.regex.Pattern;

/** 커뮤니티 닉네임 규칙(API 명세 6.6): 앞뒤 공백을 지운 2~12자, 한글 완성형·영문·숫자만. */
public final class Nickname {
    private static final Pattern ALLOWED = Pattern.compile("[가-힣A-Za-z0-9]{2,12}");

    private Nickname() {}

    public static String of(Object raw) {
        if (!(raw instanceof String value)) {
            throw ApiException.invalidInput("nickname", "닉네임을 입력해 주세요.");
        }
        String nickname = value.strip();
        if (!ALLOWED.matcher(nickname).matches()) {
            throw ApiException.invalidInput("nickname", "닉네임은 한글·영문·숫자 2~12자로 입력해 주세요.");
        }
        return nickname;
    }
}
