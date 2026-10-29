package com.dartinsight.checkpoint.domain;

/** 두 사업보고서 재무제표를 받은 결과(docs/api-spec.md {@code statementStatus}) */
public enum StatementStatus {
    /** 두 보고서 모두 재무제표가 있음 */
    AVAILABLE,
    /** 어느 한쪽이라도 자료가 없음(013, 2015 사업연도 이전 포함) */
    NOT_AVAILABLE,
    /** 어느 한쪽이라도 OpenDART에서 받지 못함(다음 요청에 다시 받음) */
    FETCH_FAILED
}
