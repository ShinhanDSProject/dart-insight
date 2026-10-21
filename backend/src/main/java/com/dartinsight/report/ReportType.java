package com.dartinsight.report;

/**
 * 정기보고서 종류. 12월 결산 회사 기준이다(분석 대상 기업 범위 잠정안).
 * reprtCode는 OpenDART 재무제표 API의 보고서 코드, disclosureType은 공시검색의 공시상세유형이다.
 */
public enum ReportType {

    Q1("11013", "A003", "1분기보고서", 3),
    HALF("11012", "A002", "반기보고서", 6),
    Q3("11014", "A003", "3분기보고서", 9),
    ANNUAL("11011", "A001", "사업보고서", 12);

    private final String reprtCode;
    private final String disclosureType;
    private final String label;
    private final int periodEndMonth;

    ReportType(String reprtCode, String disclosureType, String label, int periodEndMonth) {
        this.reprtCode = reprtCode;
        this.disclosureType = disclosureType;
        this.label = label;
        this.periodEndMonth = periodEndMonth;
    }

    public String disclosureType() {
        return disclosureType;
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
