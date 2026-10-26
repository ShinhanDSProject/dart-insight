package com.dartinsight.company.domain;

import com.dartinsight.dart.domain.CompanyOverviewEntry;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Optional;

/**
 * 기업개황(OpenDART company.json) 캐시. 회사마다 한 행이고 받은 시각(fetchedAt)으로 다시 받을지 정한다
 * (docs/erd.md company_overview, ADR-0024). 013(자료 없음)이면 status가 NO_DATA이고 값은 모두 null이다.
 */
@Entity
@Table(name = "company_overview")
public class CompanyOverview {

    public enum Status {
        OK, NO_DATA
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "corp_code", nullable = false, unique = true, length = 8)
    private String corpCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 10)
    private Status status;

    @Column(name = "corp_name", length = 200)
    private String corpName;

    @Column(name = "corp_name_eng", length = 200)
    private String corpNameEng;

    @Column(name = "stock_name", length = 200)
    private String stockName;

    @Column(name = "stock_code", length = 6)
    private String stockCode;

    @Column(name = "ceo_nm", length = 200)
    private String ceoName;

    @Column(name = "corp_cls", length = 1)
    private String corpClass;

    @Column(name = "induty_code", length = 10)
    private String indutyCode;

    @Column(name = "est_dt")
    private LocalDate establishedDate;

    @Column(name = "acc_mt")
    private Integer accountingMonth;

    @Column(name = "hm_url", length = 300)
    private String homepageUrl;

    @Column(name = "ir_url", length = 300)
    private String irUrl;

    @Column(name = "adres", length = 500)
    private String address;

    @Column(name = "phn_no", length = 50)
    private String phoneNumber;

    @Column(name = "fetched_at", nullable = false)
    private LocalDateTime fetchedAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    protected CompanyOverview() {
    }

    /** @param entry OpenDART가 준 개황. 비었으면 013(자료 없음) */
    public static CompanyOverview create(String corpCode, Optional<CompanyOverviewEntry> entry, LocalDateTime now) {
        CompanyOverview overview = new CompanyOverview();
        overview.corpCode = corpCode;
        overview.createdAt = now;
        overview.refresh(entry, now);
        return overview;
    }

    /** 새로 받은 값으로 모두 바꾸고 받은 시각을 now로 둔다. */
    public void refresh(Optional<CompanyOverviewEntry> entry, LocalDateTime now) {
        CompanyOverviewEntry e = entry.orElse(null);
        status = e == null ? Status.NO_DATA : Status.OK;
        corpName = e == null ? null : e.corpName();
        corpNameEng = e == null ? null : e.corpNameEng();
        stockName = e == null ? null : e.stockName();
        stockCode = e == null ? null : e.stockCode();
        ceoName = e == null ? null : e.ceoName();
        corpClass = e == null ? null : e.corpClass();
        indutyCode = e == null ? null : e.indutyCode();
        establishedDate = e == null ? null : e.establishedDate();
        accountingMonth = e == null ? null : e.accountingMonth();
        homepageUrl = e == null ? null : e.homepageUrl();
        irUrl = e == null ? null : e.irUrl();
        address = e == null ? null : e.address();
        phoneNumber = e == null ? null : e.phoneNumber();
        fetchedAt = now;
        updatedAt = now;
    }

    public boolean isAvailable() {
        return status == Status.OK;
    }

    public Long getId() {
        return id;
    }

    public String getCorpCode() {
        return corpCode;
    }

    public Status getStatus() {
        return status;
    }

    public String getCorpName() {
        return corpName;
    }

    public String getCorpNameEng() {
        return corpNameEng;
    }

    public String getStockName() {
        return stockName;
    }

    public String getStockCode() {
        return stockCode;
    }

    public String getCeoName() {
        return ceoName;
    }

    public String getCorpClass() {
        return corpClass;
    }

    public String getIndutyCode() {
        return indutyCode;
    }

    public LocalDate getEstablishedDate() {
        return establishedDate;
    }

    public Integer getAccountingMonth() {
        return accountingMonth;
    }

    public String getHomepageUrl() {
        return homepageUrl;
    }

    public String getIrUrl() {
        return irUrl;
    }

    public String getAddress() {
        return address;
    }

    public String getPhoneNumber() {
        return phoneNumber;
    }

    public LocalDateTime getFetchedAt() {
        return fetchedAt;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
