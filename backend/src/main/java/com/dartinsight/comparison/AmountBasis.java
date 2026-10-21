package com.dartinsight.comparison;

/** 비교하는 금액의 기간 기준(docs/api-spec.md 공통 값). */
public enum AmountBasis {
    /** 시점 금액(재무상태표) */
    POINT,
    /** 사업연도 시작부터의 누적 금액 */
    CUMULATIVE,
    /** 3개월 금액(분·반기 손익) */
    QUARTER
}
