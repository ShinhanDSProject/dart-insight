package com.dartinsight.keyfact.domain;

/**
 * 한 보고서의 묶음 상태(docs/api-spec.md). 저장하는 것은 AVAILABLE(저장 값 OK)과 NO_DATA뿐이다.
 */
public enum KeyFactStatus {
    /** 자료 있음 */
    AVAILABLE,
    /** 공시된 자료 없음(013, 2015 사업연도 이전, 응답이 다른 기간(결산기준일)의 자료) */
    NO_DATA,
    /** 이번에 받지 못함(OpenDART 호출 실패). 저장하지 않는다 */
    UNAVAILABLE
}
