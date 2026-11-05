package com.dartinsight.auth.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;

/** 비밀번호 재설정 링크 토큰(6.8, ADR-0055). 만료 전에 한 번만 쓰고, 쓰거나 새 요청으로 대체되면 used_at이 찬다. */
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "password_reset_token")
public class PasswordResetToken {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "user_id", nullable = false)
    private Long userId;
    @Column(name = "token_hash", nullable = false, unique = true, length = 43)
    private String tokenHash;
    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;
    @Column(name = "used_at")
    private LocalDateTime usedAt;
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    public static PasswordResetToken create(long userId, String tokenHash, LocalDateTime now, LocalDateTime expiresAt) {
        PasswordResetToken token = new PasswordResetToken();
        token.userId = userId;
        token.tokenHash = tokenHash;
        token.createdAt = now;
        token.expiresAt = expiresAt;
        return token;
    }

    public boolean usableAt(LocalDateTime now) { return usedAt == null && expiresAt.isAfter(now); }

    public void use(LocalDateTime now) {
        if (!usableAt(now)) throw new IllegalStateException("이미 쓰거나 만료된 재설정 토큰");
        usedAt = now;
    }

    public long userId() { return userId; }
}
