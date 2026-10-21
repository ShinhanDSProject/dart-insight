package com.dartinsight.financial;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * 재무제표 계정 한 줄(docs/erd.md). 근거로 접수번호·재무제표 종류(sj_div)·계정 ID를 남긴다.
 * 금액은 원 단위이고, 없는 값은 null이다(0과 구분).
 */
@Entity
@Table(name = "financial_account")
public class FinancialAccount {

    /** OpenDART가 표준계정이 아닌 계정에 주는 account_id */
    public static final String NON_STANDARD_ACCOUNT_ID = "-표준계정코드 미사용-";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "fetch_id", nullable = false)
    private Long fetchId;

    @Column(name = "rcept_no", nullable = false, length = 14)
    private String rceptNo;

    @Column(name = "sj_div", nullable = false, length = 5)
    private String sjDiv;

    @Column(name = "sj_name", length = 100)
    private String sjName;

    @Column(name = "account_id", nullable = false, length = 200)
    private String accountId;

    @Column(name = "account_name", nullable = false, length = 200)
    private String accountName;

    @Column(name = "account_detail", length = 500)
    private String accountDetail;

    @Column(name = "ord")
    private Integer ord;

    @Column(name = "currency", length = 10)
    private String currency;

    @Column(name = "thstrm_name", length = 50)
    private String thstrmName;

    @Column(name = "frmtrm_name", length = 50)
    private String frmtrmName;

    @Column(name = "thstrm_amount")
    private Long thstrmAmount;

    @Column(name = "thstrm_add_amount")
    private Long thstrmAddAmount;

    @Column(name = "frmtrm_amount")
    private Long frmtrmAmount;

    @Column(name = "frmtrm_q_amount")
    private Long frmtrmQAmount;

    @Column(name = "frmtrm_add_amount")
    private Long frmtrmAddAmount;

    protected FinancialAccount() {
    }

    public FinancialAccount(Long fetchId, String rceptNo, String sjDiv, String sjName, String accountId,
            String accountName, String accountDetail, Integer ord, String currency, String thstrmName,
            String frmtrmName,
            Long thstrmAmount, Long thstrmAddAmount, Long frmtrmAmount, Long frmtrmQAmount, Long frmtrmAddAmount) {
        this.fetchId = fetchId;
        this.rceptNo = rceptNo;
        this.sjDiv = sjDiv;
        this.sjName = sjName;
        this.accountId = accountId;
        this.accountName = accountName;
        this.accountDetail = accountDetail;
        this.ord = ord;
        this.currency = currency;
        this.thstrmName = thstrmName;
        this.frmtrmName = frmtrmName;
        this.thstrmAmount = thstrmAmount;
        this.thstrmAddAmount = thstrmAddAmount;
        this.frmtrmAmount = frmtrmAmount;
        this.frmtrmQAmount = frmtrmQAmount;
        this.frmtrmAddAmount = frmtrmAddAmount;
    }

    public boolean isStandardAccount() {
        return accountId != null && !accountId.isBlank() && !NON_STANDARD_ACCOUNT_ID.equals(accountId);
    }

    public Long getId() {
        return id;
    }

    public Long getFetchId() {
        return fetchId;
    }

    public String getRceptNo() {
        return rceptNo;
    }

    public String getSjDiv() {
        return sjDiv;
    }

    public String getSjName() {
        return sjName;
    }

    public String getAccountId() {
        return accountId;
    }

    public String getAccountName() {
        return accountName;
    }

    public String getAccountDetail() {
        return accountDetail;
    }

    public Integer getOrd() {
        return ord;
    }

    public String getCurrency() {
        return currency;
    }

    public String getThstrmName() {
        return thstrmName;
    }

    public String getFrmtrmName() {
        return frmtrmName;
    }

    /** 당기 금액. 분·반기 손익계산서는 3개월 금액 */
    public Long getThstrmAmount() {
        return thstrmAmount;
    }

    /** 당기 누적 금액(분·반기 손익) */
    public Long getThstrmAddAmount() {
        return thstrmAddAmount;
    }

    public Long getFrmtrmAmount() {
        return frmtrmAmount;
    }

    public Long getFrmtrmQAmount() {
        return frmtrmQAmount;
    }

    public Long getFrmtrmAddAmount() {
        return frmtrmAddAmount;
    }
}
