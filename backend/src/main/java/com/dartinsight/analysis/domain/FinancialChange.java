package com.dartinsight.analysis.domain;

import com.dartinsight.comparison.domain.AmountBasis;
import com.dartinsight.financial.domain.FsDiv;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * 저장된 계정별 비교 결과(docs/erd.md financial_change). 한 분석에만 속하고, 다른 분석 결과와 섞지 않는다.
 */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "financial_change")
public class FinancialChange {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "analysis_id", nullable = false)
    private Long analysisId;

    @Column(name = "sj_div", nullable = false, length = 5)
    private String sjDiv;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "fs_div", nullable = false, length = 3)
    private FsDiv fsDiv;

    @Column(name = "account_key", nullable = false, length = 1000)
    private String accountKey;

    @Column(name = "account_name", nullable = false, length = 200)
    private String accountName;

    /** 자본변동표의 계정 상세(자본 구성요소). 다른 재무제표는 null(#401) */
    @Column(name = "account_detail", length = 500)
    private String accountDetail;

    @Column(name = "display_order", nullable = false)
    private int displayOrder;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "amount_basis", length = 10)
    private AmountBasis amountBasis;

    @Column(name = "previous_amount")
    private Long previousAmount;

    @Column(name = "current_amount")
    private Long currentAmount;

    @Column(name = "change_amount")
    private Long changeAmount;

    @Column(name = "change_rate", precision = 20, scale = 6)
    private BigDecimal changeRate;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "calc_status", nullable = false, length = 20)
    private CalcStatus calcStatus;

    @Column(name = "currency", length = 10)
    private String currency;

    @Column(name = "previous_rcept_no", length = 14)
    private String previousRceptNo;

    @Column(name = "current_rcept_no", length = 14)
    private String currentRceptNo;

    @Column(name = "previous_account_id", length = 200)
    private String previousAccountId;

    @Column(name = "current_account_id", length = 200)
    private String currentAccountId;

    @Column(name = "previous_period_name", length = 50)
    private String previousPeriodName;

    @Column(name = "current_period_name", length = 50)
    private String currentPeriodName;

    public static FinancialChange of(Long analysisId, FinancialChangeRow row) {
        FinancialChange c = new FinancialChange();
        c.analysisId = analysisId;
        c.sjDiv = row.sjDiv();
        c.fsDiv = row.fsDiv();
        c.accountKey = row.accountKey();
        c.accountName = row.accountName();
        c.accountDetail = row.accountDetail();
        c.displayOrder = row.displayOrder();
        c.amountBasis = row.amountBasis();
        c.previousAmount = row.previousAmount();
        c.currentAmount = row.currentAmount();
        c.changeAmount = row.changeAmount();
        c.changeRate = row.changeRate();
        c.calcStatus = row.calcStatus();
        c.currency = row.currency();
        if (row.previous() != null) {
            c.previousRceptNo = row.previous().rceptNo();
            c.previousAccountId = row.previous().accountId();
            c.previousPeriodName = row.previous().periodName();
        }
        if (row.current() != null) {
            c.currentRceptNo = row.current().rceptNo();
            c.currentAccountId = row.current().accountId();
            c.currentPeriodName = row.current().periodName();
        }
        return c;
    }

    /** 값이 바뀌었거나 계산하지 못한 항목인지 */
    public boolean changedOrUncalculated() {
        return changeAmount == null || changeAmount != 0;
    }

    /** 증감 방향. 계산하지 않았으면 null */
    public String direction() {
        if (changeAmount == null) {
            return null;
        }
        return changeAmount > 0 ? "UP" : changeAmount < 0 ? "DOWN" : "SAME";
    }
}
