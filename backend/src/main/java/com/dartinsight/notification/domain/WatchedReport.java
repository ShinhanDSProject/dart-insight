package com.dartinsight.notification.domain;

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

/** 즐겨찾기 폴링이 찾아 자동 분석을 요청한 새 정기보고서(6.4, ADR-0031). 이 보고서의 분석이 끝나면 알린다. */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "watched_report")
public class WatchedReport {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "rcept_no", nullable = false, length = 14)
    private String rceptNo;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    public static WatchedReport create(String rceptNo, LocalDateTime now) {
        WatchedReport watched = new WatchedReport();
        watched.rceptNo = rceptNo;
        watched.createdAt = now;
        return watched;
    }
}
