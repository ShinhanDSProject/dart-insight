package com.dartinsight.favorite.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 회원이 고정한 관심 기업 한 곳(6.2, #36). 회원과 기업 쌍은 한 번만 있다. */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "favorite_company")
public class FavoriteCompany {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "corp_code", nullable = false, length = 8)
    private String corpCode;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    public static FavoriteCompany create(long userId, String corpCode, LocalDateTime now) {
        FavoriteCompany favorite = new FavoriteCompany();
        favorite.userId = userId;
        favorite.corpCode = corpCode;
        favorite.createdAt = now;
        return favorite;
    }
}
