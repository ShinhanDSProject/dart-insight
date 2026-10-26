package com.dartinsight.disclosure.domain;

/**
 * 공시 묶음(docs/api-spec.md 공통 값 disclosureGroup). 선언 순서가 화면의 거르기 순서다.
 * 어떤 공시가 어느 묶음인지는 {@link DisclosureGroupRules}가 제목 낱말로 정한다.
 */
public enum DisclosureGroup {
    PERIODIC("정기보고서"),
    OWNERSHIP("지분 변동"),
    FUNDING("자금 조달"),
    GOVERNANCE("지배구조"),
    BUSINESS("실적·영업"),
    OTHER("기타");

    private final String label;

    DisclosureGroup(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }
}
