package com.dartinsight.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.dartinsight.common.error.ApiException;
import org.junit.jupiter.api.Test;

class RegistrationInputTest {
    @Test
    void checksExactEmailBoundaries() {
        String domain = "b".repeat(63) + "." + "c".repeat(63) + "." + "d".repeat(61);
        String email = "a".repeat(64) + "@" + domain;
        assertThat(email).hasSize(254);
        assertThat(RegistrationInput.email(email)).isEqualTo(email);
        assertThatThrownBy(() -> RegistrationInput.email(email + "d")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> RegistrationInput.email("a".repeat(65) + "@example.com"))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> RegistrationInput.email("a@" + "b".repeat(64) + ".com"))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> RegistrationInput.email("\tuser@example.com"))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void preservesPasswordAndCountsCodePoints() {
        assertThat(RegistrationInput.password("A!" + "a".repeat(8))).isEqualTo("A!" + "a".repeat(8));
        assertThat(RegistrationInput.password("A!" + "😀".repeat(126))).isEqualTo("A!" + "😀".repeat(126));
        assertThatThrownBy(() -> RegistrationInput.password("A!" + "a".repeat(7))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> RegistrationInput.password("A!" + "😀".repeat(127))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> RegistrationInput.password(" ".repeat(10))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> RegistrationInput.password("\u00a0".repeat(10))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> RegistrationInput.password("A!" + "a".repeat(8) + (char) 0))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> RegistrationInput.password("A!" + "a".repeat(8) + (char) 0xd800))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> RegistrationInput.password("lowercase!1"))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> RegistrationInput.password("Uppercase12"))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> RegistrationInput.password("Αlpha!1234"))
                .isInstanceOf(ApiException.class);
        assertThat(new RegistrationController.RegistrationRequest().toString())
                .isEqualTo("RegistrationRequest[redacted]");
    }
}
