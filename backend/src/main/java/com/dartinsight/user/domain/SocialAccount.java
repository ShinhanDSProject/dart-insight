package com.dartinsight.user.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name = "social_account")
public class SocialAccount {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "user_id", nullable = false)
    private Long userId;
    @Column(nullable = false, length = 20)
    private String provider;
    @Column(name = "provider_user_id", nullable = false)
    private String providerUserId;
    @Column(length = 254)
    private String email;
    @Column(name = "email_verified", nullable = false)
    private boolean emailVerified;
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    protected SocialAccount() {}

    public static SocialAccount create(long userId, SocialIdentity identity, LocalDateTime now) {
        SocialAccount account = new SocialAccount();
        account.userId = userId;
        account.provider = identity.provider();
        account.providerUserId = identity.providerUserId();
        account.email = identity.email();
        account.emailVerified = identity.emailVerified();
        account.createdAt = now;
        account.updatedAt = now;
        return account;
    }

    public long userId() { return userId; }
}
