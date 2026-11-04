package com.dartinsight.user.domain;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class EmailMaskTest {

    @ParameterizedTest
    @CsvSource({
            "tjdals@gmail.com, tj***@g***.com",
            "ab@naver.com, a***@n***.com",
            "a@kakao.co.kr, a***@k***.kr",
            "abc@localhost, ab***@l***",
            "@gmail.com, ***",
            "tjdals@, ***"})
    @DisplayName("아이디 앞 2자(2자 이하면 1자)·도메인 첫 글자·마지막 점 뒤 끝말만 남기고 가린다")
    void masksLocalPartAndDomain(String email, String masked) {
        assertThat(EmailMask.mask(email)).isEqualTo(masked);
    }

    @Test
    @DisplayName("이메일이 없으면 null이다")
    void returnsNullWithoutEmail() {
        assertThat(EmailMask.mask(null)).isNull();
        assertThat(EmailMask.mask(" ")).isNull();
    }
}
