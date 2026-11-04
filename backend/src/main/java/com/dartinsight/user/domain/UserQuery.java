package com.dartinsight.user.domain;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.web.PageParams;
import java.util.Arrays;
import java.util.Locale;

/**
 * 관리자 회원 목록 조건(GET /api/admin/users).
 *
 * @param text 앞뒤 공백을 지운 검색어. 없거나 비었으면 null
 * @param role 역할. 없으면 null(전체)
 */
public record UserQuery(String text, UserRole role, PageParams page) {
    private static final int MAX_TEXT = 50;

    public static UserQuery of(String q, String role, Integer page, Integer size) {
        return new UserQuery(text(q), role(role), PageParams.of(page, size));
    }

    /** 닉네임 부분 일치 LIKE 패턴(소문자). LIKE의 %·_·!는 '!'로 이스케이프한다. 검색어가 없으면 null */
    public String nicknamePattern() {
        if (text == null) return null;
        String escaped = text.toLowerCase(Locale.ROOT).replace("!", "!!").replace("%", "!%").replace("_", "!_");
        return "%" + escaped + "%";
    }

    /** 이메일 전체 일치(대소문자 무시)에 쓸 소문자 검색어. 검색어가 없으면 null */
    public String email() {
        return text == null ? null : text.toLowerCase(Locale.ROOT);
    }

    /**
     * 일반 가입 이메일과 비교할 소문자 검색어. local_credential.email은 ASCII(ascii_bin)로 정규화해 저장하므로
     * ASCII가 아닌 검색어는 맞을 수 없고, MariaDB에서 문자셋이 섞인 비교(Illegal mix of collations)가 되므로 null로 둔다.
     */
    public String localEmail() {
        String email = email();
        return email != null && email.chars().allMatch(c -> c < 128) ? email : null;
    }

    private static String text(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String stripped = raw.strip();
        if (stripped.length() > MAX_TEXT) throw ApiException.invalidInput("q", "50자 이하여야 합니다.");
        return stripped;
    }

    private static UserRole role(String raw) {
        if (raw == null || raw.isBlank()) return null;
        return Arrays.stream(UserRole.values())
                .filter(value -> value.name().equals(raw.strip()))
                .findFirst()
                .orElseThrow(() -> ApiException.invalidInput("role", "USER 또는 ADMIN이어야 합니다."));
    }
}
