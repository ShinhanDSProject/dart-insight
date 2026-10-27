package com.dartinsight.user.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;

/** 일반 가입 정보. 소셜 회원은 이 행 없이 같은 User를 사용할 수 있다. */
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "local_credential")
public class LocalCredential {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Column(nullable = false, length = 254)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Column(name = "email_verified", nullable = false)
    private boolean emailVerified;

    public static LocalCredential create(User user, String email, String passwordHash) {
        LocalCredential credential = new LocalCredential();
        credential.user = user;
        credential.email = email;
        credential.passwordHash = passwordHash;
        credential.emailVerified = false;
        return credential;
    }

    public boolean matchesPassword(PasswordEncoder encoder, String password) {
        return encoder.matches(password, passwordHash);
    }

    public long userId() { return user.getId(); }

    public String email() { return email; }
}
