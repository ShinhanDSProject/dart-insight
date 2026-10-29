package com.dartinsight.user.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 로그인 방식과 독립적인 내부 회원 식별자. */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "app_user")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 커뮤니티에 보이는 이름(6.6). 정하지 않았으면 null. */
    @Column(length = 12, unique = true)
    private String nickname;

    /** 관리자 API 권한(ADR-0040). */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private UserRole role;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public static User create(LocalDateTime now) {
        User user = new User();
        user.role = UserRole.USER;
        user.createdAt = now;
        user.updatedAt = now;
        return user;
    }

    public boolean isAdmin() {
        return role == UserRole.ADMIN;
    }

    /** 규칙을 통과한 닉네임으로 바꾼다. 지금과 같으면 그대로 둔다. */
    public void changeNickname(String validNickname, LocalDateTime now) {
        if (validNickname.equals(nickname)) return;
        nickname = validNickname;
        updatedAt = now;
    }

    /** 관리자로 올린다. 이미 관리자였으면 false. */
    public boolean grantAdmin(LocalDateTime now) {
        if (isAdmin()) return false;
        role = UserRole.ADMIN;
        updatedAt = now;
        return true;
    }
}
