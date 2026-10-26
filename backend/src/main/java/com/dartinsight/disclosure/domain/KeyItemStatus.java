package com.dartinsight.disclosure.domain;

/** 핵심 수치를 받은 결과. AVAILABLE 항목 있음, NO_DATA OpenDART에 자료 없음(013 또는 같은 접수번호의 행 없음) */
public enum KeyItemStatus {
    AVAILABLE,
    NO_DATA
}
