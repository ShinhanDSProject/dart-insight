package com.dartinsight.company.domain;

import com.dartinsight.dart.domain.CorpCodeEntry;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Objects;

/**
 * 기업. 기본키는 자동 증가 id이고, 회사는 OpenDART 고유번호(corp_code, UNIQUE)로 가리킨다(docs/erd.md, ADR-0017).
 * 기업 목록을 새로 넣을 때는 CompanyStore로 일괄 저장한다.
 */
@Entity
@Table(name = "company")
public class Company {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "corp_code", nullable = false, unique = true, length = 8)
    private String corpCode;

    @Column(name = "corp_name", nullable = false, length = 200)
    private String corpName;

    @Column(name = "corp_eng_name", length = 200)
    private String corpEngName;

    @Column(name = "stock_code", length = 6)
    private String stockCode;

    @Column(name = "modify_date")
    private LocalDate modifyDate;

    @Column(name = "reports_fetched_at")
    private LocalDateTime reportsFetchedAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    protected Company() {
    }

    /** 바뀐 값이 있으면 고치고 true를 돌려준다. */
    public boolean updateFrom(CorpCodeEntry entry, LocalDateTime now) {
        boolean changed = !Objects.equals(corpName, entry.corpName())
                || !Objects.equals(corpEngName, entry.corpEngName())
                || !Objects.equals(stockCode, entry.stockCode())
                || !Objects.equals(modifyDate, entry.modifyDate());
        if (changed) {
            corpName = entry.corpName();
            corpEngName = entry.corpEngName();
            stockCode = entry.stockCode();
            modifyDate = entry.modifyDate();
            updatedAt = now;
        }
        return changed;
    }

    public void markReportsFetched(LocalDateTime now) {
        reportsFetchedAt = now;
        updatedAt = now;
    }

    public boolean isListed() {
        return stockCode != null;
    }

    public Long getId() {
        return id;
    }

    public String getCorpCode() {
        return corpCode;
    }

    public String getCorpName() {
        return corpName;
    }

    public String getCorpEngName() {
        return corpEngName;
    }

    public String getStockCode() {
        return stockCode;
    }

    public LocalDate getModifyDate() {
        return modifyDate;
    }

    public LocalDateTime getReportsFetchedAt() {
        return reportsFetchedAt;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
