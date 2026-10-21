package com.dartinsight.financial;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * 재무제표 API를 한 번 부른 결과(docs/erd.md). 같은 기업·사업연도·보고서 코드·기준은 다시 부르지 않는다.
 */
@Entity
@Table(name = "financial_statement_fetch")
public class FinancialStatementFetch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "corp_code", nullable = false, length = 8)
    private String corpCode;

    @Column(name = "fiscal_year", nullable = false)
    private int fiscalYear;

    @Column(name = "reprt_code", nullable = false, length = 5)
    private String reprtCode;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "fs_div", nullable = false, length = 3)
    private FsDiv fsDiv;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "status", nullable = false, length = 10)
    private FetchStatus status;

    @Column(name = "rcept_no", length = 14)
    private String rceptNo;

    @Column(name = "fetched_at", nullable = false)
    private LocalDateTime fetchedAt;

    protected FinancialStatementFetch() {
    }

    public FinancialStatementFetch(String corpCode, int fiscalYear, String reprtCode, FsDiv fsDiv,
            FetchStatus status, String rceptNo, LocalDateTime fetchedAt) {
        this.corpCode = corpCode;
        this.fiscalYear = fiscalYear;
        this.reprtCode = reprtCode;
        this.fsDiv = fsDiv;
        this.status = status;
        this.rceptNo = rceptNo;
        this.fetchedAt = fetchedAt;
    }

    /** 같은 조합을 다시 받았을 때 결과를 바꾼다. */
    void refresh(FetchStatus status, String rceptNo, LocalDateTime fetchedAt) {
        this.status = status;
        this.rceptNo = rceptNo;
        this.fetchedAt = fetchedAt;
    }

    public Long getId() {
        return id;
    }

    public String getCorpCode() {
        return corpCode;
    }

    public int getFiscalYear() {
        return fiscalYear;
    }

    public String getReprtCode() {
        return reprtCode;
    }

    public FsDiv getFsDiv() {
        return fsDiv;
    }

    public FetchStatus getStatus() {
        return status;
    }

    public boolean hasData() {
        return status == FetchStatus.OK;
    }

    public String getRceptNo() {
        return rceptNo;
    }

    public LocalDateTime getFetchedAt() {
        return fetchedAt;
    }
}
