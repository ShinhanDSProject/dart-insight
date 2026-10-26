package com.dartinsight.keyfact.domain;

/** 정기보고서 주요정보 묶음. 저장(report_key_fact.kind)에 이 이름을 쓴다. */
public enum KeyFactKind {
    /** 최대주주 현황 */
    MAJOR_SHAREHOLDERS,
    /** 임원 현황 */
    EXECUTIVES,
    /** 배당에 관한 사항 */
    DIVIDENDS
}
