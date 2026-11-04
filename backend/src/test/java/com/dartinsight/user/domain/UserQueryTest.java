package com.dartinsight.user.domain;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class UserQueryTest {

    @Test
    @DisplayName("이메일 검색어는 소문자로 바꾸고, 일반 가입 이메일(ASCII)과는 ASCII 검색어만 비교한다")
    void comparesLocalEmailOnlyForAsciiText() {
        UserQuery ascii = UserQuery.of(" TJDALS@Gmail.com ", null, null, null);
        assertThat(ascii.email()).isEqualTo("tjdals@gmail.com");
        assertThat(ascii.localEmail()).isEqualTo("tjdals@gmail.com");

        UserQuery korean = UserQuery.of("반도체공부중", null, null, null);
        assertThat(korean.email()).isEqualTo("반도체공부중");
        assertThat(korean.localEmail()).isNull();

        UserQuery none = UserQuery.of(null, null, null, null);
        assertThat(none.email()).isNull();
        assertThat(none.localEmail()).isNull();
    }
}
