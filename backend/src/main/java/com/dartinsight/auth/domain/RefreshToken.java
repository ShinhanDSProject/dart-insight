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

@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "refresh_token")
public class RefreshToken {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "user_id", nullable = false)
    private Long userId;
    @Column(name = "token_hash", nullable = false, unique = true, length = 43)
    private String tokenHash;
    @Column(name = "family_id", nullable = false, length = 36)
    private String familyId;
    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
    @Column(name = "last_used_at")
    private LocalDateTime lastUsedAt;
    @Column(name = "revoked_at")
    private LocalDateTime revokedAt;
    @Column(name = "replaced_by_id")
    private Long replacedById;

    public static RefreshToken create(long userId, String tokenHash, String familyId,
            LocalDateTime now, LocalDateTime expiresAt) {
        RefreshToken token = new RefreshToken();
        token.userId = userId;
        token.tokenHash = tokenHash;
        token.familyId = familyId;
        token.createdAt = now;
        token.expiresAt = expiresAt;
        return token;
    }

    public boolean isActive(LocalDateTime now) { return revokedAt == null && expiresAt.isAfter(now); }
    public void rotate(LocalDateTime now, long replacementId) {
        lastUsedAt = now;
        revokedAt = now;
        replacedById = replacementId;
    }
    public void revoke(LocalDateTime now) { if (revokedAt == null) revokedAt = now; }
    public long id() { return id; }
    public long userId() { return userId; }
    public String familyId() { return familyId; }
    public boolean wasRevoked() { return revokedAt != null; }
}
