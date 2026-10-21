package com.dartinsight.report;

/**
 * 정기보고서 종류. reprtCode는 OpenDART 재무제표 API의 보고서 코드다.
 * 12월 결산 회사 기준이다(분석 대상 기업 범위 잠정안).
 */
public enum ReportType {

    Q1("11013", "1분기보고서", 3),
    HALF("11012", "반기보고서", 6),
    Q3("11014", "3분기보고서", 9),
    ANNUAL("11011", "사업보고서", 12);

    private final String reprtCode;
    private final String label;
    private final int periodEndMonth;

    ReportType(String reprtCode, String label, int periodEndMonth) {
        this.reprtCode = reprtCode;
        this.label = label;
        this.periodEndMonth = periodEndMonth;
    }

    public String reprtCode() {
        return reprtCode;
    }

    public String label() {
        return label;
    }

    public int periodEndMonth() {
        return periodEndMonth;
    }
}
