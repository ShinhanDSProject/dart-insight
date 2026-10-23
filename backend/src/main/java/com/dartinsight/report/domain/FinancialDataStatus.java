package com.dartinsight.report.domain;

/**
 * 보고서의 재무제표 자료 상태(docs/api-spec.md 공통 값). 정하는 규칙은 FinancialDataStatusProvider 구현(4.5)에 있다.
 */
public enum FinancialDataStatus {
    UNKNOWN, AVAILABLE, NOT_AVAILABLE;

    /** OpenDART 재무제표 API(fnlttSinglAcntAll)는 2015 사업연도부터 제공한다. */
    public static final int FIRST_FISCAL_YEAR = 2015;
}
