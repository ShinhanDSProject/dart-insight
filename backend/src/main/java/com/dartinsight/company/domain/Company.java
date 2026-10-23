package com.dartinsight.company.domain;

import com.dartinsight.dart.domain.CorpCodeEntry;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Objects;
import org.springframework.data.domain.Persistable;

/**
 * 기업. OpenDART 고유번호(corp_code)가 키다(docs/erd.md).
 * 키를 직접 정하는 엔티티라서 Persistable로 새 엔티티인지 알려 저장할 때 불필요한 SELECT를 줄인다.
 */
@Entity
@Table(name = "company")
public class Company implements Persistable<String> {

    @Id
    @Column(name = "corp_code", length = 8)
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

    @Transient
    private boolean newEntity;

    protected Company() {
    }

    public static Company create(CorpCodeEntry entry, LocalDateTime now) {
        Company company = new Company();
        company.corpCode = entry.corpCode();
        company.corpName = entry.corpName();
        company.corpEngName = entry.corpEngName();
        company.stockCode = entry.stockCode();
        company.modifyDate = entry.modifyDate();
        company.createdAt = now;
        company.updatedAt = now;
        company.newEntity = true;
        return company;
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

    @Override
    public String getId() {
        return corpCode;
    }

    @Override
    public boolean isNew() {
        return newEntity;
    }

    @PostLoad
    @PostPersist
    void markNotNew() {
        newEntity = false;
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
