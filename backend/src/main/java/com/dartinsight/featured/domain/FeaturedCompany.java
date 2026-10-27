package com.dartinsight.featured.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 첫 화면 대표 기업 한 곳(1.5, #399). 시가총액은 순위의 근거로만 남기고 내보내지 않는다(ADR-0033). */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "featured_company")
public class FeaturedCompany {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "rank_no", nullable = false)
    private int rankNo;

    @Column(name = "corp_code", nullable = false, length = 8)
    private String corpCode;

    @Column(name = "market_cap", nullable = false)
    private long marketCap;

    @Column(name = "base_date", nullable = false)
    private LocalDate baseDate;

    @Column(name = "fetched_at", nullable = false)
    private LocalDateTime fetchedAt;

    public static FeaturedCompany create(int rankNo, String corpCode, long marketCap, LocalDate baseDate,
            LocalDateTime fetchedAt) {
        FeaturedCompany featured = new FeaturedCompany();
        featured.rankNo = rankNo;
        featured.corpCode = corpCode;
        featured.marketCap = marketCap;
        featured.baseDate = baseDate;
        featured.fetchedAt = fetchedAt;
        return featured;
    }
}
