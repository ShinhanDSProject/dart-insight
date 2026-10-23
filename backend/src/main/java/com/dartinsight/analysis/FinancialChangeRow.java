package com.dartinsight.analysis;

import com.dartinsight.comparison.domain.AmountBasis;
import com.dartinsight.financial.domain.FsDiv;
import java.math.BigDecimal;

/**
 * 계정 하나의 비교 결과(2.4). 저장은 4.3(financial_change)에서 한다.
 *
 * @param accountKey   두 보고서의 계정을 맞춘 키(표준계정코드, 없으면 "NAME:" + 정규화한 계정명)
 * @param amountBasis  비교한 금액 기준. 기간 기준이 달라 비교하지 않으면 null
 * @param changeAmount 현재 값 − 이전 값. 계산하지 않으면 null
 * @param changeRate   증감액 ÷ 이전 값(소수 6자리). 계산하지 않으면 null
 */
public record FinancialChangeRow(
        String sjDiv,
        FsDiv fsDiv,
        String accountKey,
        String accountName,
        int displayOrder,
        AmountBasis amountBasis,
        Long previousAmount,
        Long currentAmount,
        Long changeAmount,
        BigDecimal changeRate,
        CalcStatus calcStatus,
        String currency,
        Evidence previous,
        Evidence current) {

    /**
     * 수치의 근거. 계정이 그 보고서에 없으면 null.
     *
     * @param periodName 응답의 당기 이름(예: 제 57 기 반기)
     */
    public record Evidence(String rceptNo, String sjDiv, String accountId, String accountName, String periodName) {
    }

    /** 증감 방향. 계산하지 않으면 null */
    public String direction() {
        if (changeAmount == null) {
            return null;
        }
        return changeAmount > 0 ? "UP" : changeAmount < 0 ? "DOWN" : "SAME";
    }
}
