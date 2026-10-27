package com.dartinsight.disclosure.domain;

/** 확인해 볼 공시 종류 하나의 상태(docs/api-spec.md). 0건과 확인하지 못함을 나눈다. */
public enum DisclosureSignalStatus {
    /** 확인함. 0건이면 해당 공시 없음 */
    CHECKED,
    /** 자료를 받지 못해 확인하지 못함. 해당 공시가 없다는 뜻이 아니다 */
    UNAVAILABLE
}
