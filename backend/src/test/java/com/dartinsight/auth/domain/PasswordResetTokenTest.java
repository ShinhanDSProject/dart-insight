package com.dartinsight.auth.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class PasswordResetTokenTest {
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 11, 5, 12, 0);

    @Test
    @DisplayName("만료 전에 한 번만 쓸 수 있다")
    void usableOnceBeforeExpiry() {
        PasswordResetToken token = PasswordResetToken.create(1L, "hash", NOW, NOW.plusMinutes(30));
        assertThat(token.usableAt(NOW.plusMinutes(29))).isTrue();
        assertThat(token.usableAt(NOW.plusMinutes(30))).isFalse();

        token.use(NOW.plusMinutes(1));
        assertThat(token.usableAt(NOW.plusMinutes(2))).isFalse();
        assertThatThrownBy(() -> token.use(NOW.plusMinutes(2))).isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("토큰은 43자 base64url 난수이고 해시는 원문과 다르며 같은 원문이면 같다")
    void opaqueTokensHashDeterministically() {
        String token = OpaqueTokens.newToken();
        assertThat(token).hasSize(43).matches("[A-Za-z0-9_-]+");
        assertThat(OpaqueTokens.newToken()).isNotEqualTo(token);
        assertThat(OpaqueTokens.hash(token)).hasSize(43).isNotEqualTo(token).isEqualTo(OpaqueTokens.hash(token));
    }
}
