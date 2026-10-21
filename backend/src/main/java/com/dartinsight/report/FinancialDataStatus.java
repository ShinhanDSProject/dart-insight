package com.dartinsight.report;

/**
 * 보고서의 재무제표 자료 상태(docs/api-spec.md 공통 값).
 * 재무제표 API(4.5)로 받아 보기 전에는 UNKNOWN이다.
 */
public enum FinancialDataStatus {
    UNKNOWN, AVAILABLE, NOT_AVAILABLE;

    /** OpenDART 재무제표 API(fnlttSinglAcntAll)는 2015 사업연도부터 제공한다. */
    public static final int FIRST_FISCAL_YEAR = 2015;

    /** 재무제표를 받아 보기 전의 상태. 제공 범위 밖의 보고서는 받아 보지 않아도 NOT_AVAILABLE이다. */
    public static FinancialDataStatus beforeFetch(Report report) {
        return report.getFiscalYear() < FIRST_FISCAL_YEAR ? NOT_AVAILABLE : UNKNOWN;
    }
}
