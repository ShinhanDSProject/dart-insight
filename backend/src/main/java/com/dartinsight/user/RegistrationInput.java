package com.dartinsight.user;

import com.dartinsight.common.error.ApiException;
import java.util.Locale;
import java.util.regex.Pattern;

/** API 명세 #136의 입력 규칙. 비밀번호는 정규화하거나 잘라내지 않는다. */
final class RegistrationInput {
    private static final Pattern LOCAL = Pattern.compile("[a-z0-9.!#$%&'*+/=?^_`{|}~-]+");
    private static final Pattern LABEL = Pattern.compile("[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?");

    private RegistrationInput() {}

    static String email(Object raw) {
        if (!(raw instanceof String value)) {
            throw ApiException.invalidInput("email", "이메일을 입력해 주세요.");
        }
        // U+0020만 제거한다. 탭/개행 등 제어문자는 유효한 이메일로 바꾸지 않는다.
        if (value.chars().anyMatch(c -> c > 127)) throw invalidEmail();
        String email = value.replaceAll("^ +| +$", "").toLowerCase(Locale.ROOT);
        int at = email.indexOf('@');
        if (email.length() > 254 || at < 1 || at > 64 || at != email.lastIndexOf('@')) {
            throw invalidEmail();
        }
        String local = email.substring(0, at);
        String[] labels = email.substring(at + 1).split("\\.", -1);
        if (!LOCAL.matcher(local).matches() || local.startsWith(".") || local.endsWith(".")
                || local.contains("..") || labels.length < 2) {
            throw invalidEmail();
        }
        for (String label : labels) {
            if (!LABEL.matcher(label).matches()) throw invalidEmail();
        }
        return email;
    }

    static String password(Object raw) {
        if (!(raw instanceof String value)) {
            throw ApiException.invalidInput("password", "비밀번호를 입력해 주세요.");
        }
        int length = value.codePointCount(0, value.length());
        if (length < 10 || length > 128) {
            throw ApiException.invalidInput("password", "비밀번호는 10~128자로 입력해 주세요.");
        }
        if (value.codePoints().allMatch(c -> Character.isWhitespace(c) || Character.isSpaceChar(c))
                || value.codePoints().anyMatch(c -> Character.isISOControl(c)
                        || (c >= 0xD800 && c <= 0xDFFF))) {
            throw ApiException.invalidInput("password", "공백만 입력하거나 제어문자를 사용할 수 없습니다.");
        }
        if (value.codePoints().noneMatch(c -> c >= 'A' && c <= 'Z')) {
            throw ApiException.invalidInput("password", "영문 대문자를 1개 이상 포함해 주세요.");
        }
        if (value.codePoints().noneMatch(c -> !Character.isLetterOrDigit(c)
                && !Character.isWhitespace(c) && !Character.isSpaceChar(c))) {
            throw ApiException.invalidInput("password", "특수문자를 1개 이상 포함해 주세요.");
        }
        return value;
    }

    private static ApiException invalidEmail() {
        return ApiException.invalidInput("email", "올바른 이메일 주소를 입력해 주세요.");
    }
}
