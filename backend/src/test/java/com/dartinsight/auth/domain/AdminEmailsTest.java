package com.dartinsight.auth.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class AdminEmailsTest {

    @Test
    @DisplayName("대소문자와 앞뒤 공백을 무시하고 비교한다")
    void matchesIgnoringCaseAndSpaces() {
        AdminEmails admins = AdminEmails.of(List.of(" Admin@Example.com ", "other@example.com"));

        assertThat(admins.containsAny(List.of("admin@example.COM"))).isTrue();
        assertThat(admins.containsAny(List.of("member@example.com"))).isFalse();
        assertThat(admins.containsAny(List.of())).isFalse();
    }

    @Test
    @DisplayName("빈 설정은 빈 목록이다")
    void blankSettingIsEmpty() {
        assertThat(AdminEmails.of(List.of("", "  ")).emails()).isEmpty();
        assertThat(AdminEmails.of(List.of()).containsAny(List.of("admin@example.com"))).isFalse();
    }
}
