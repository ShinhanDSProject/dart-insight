package com.dartinsight.relateddisclosure.domain;

/** 문장 변경 하나의 관련 수시공시 상태. FOUND 1건 이상, NOT_FOUND 찾지 못함, UNAVAILABLE 공시 목록을 지금 받지 못함 */
public enum RelatedStatus {
    FOUND,
    NOT_FOUND,
    UNAVAILABLE
}
