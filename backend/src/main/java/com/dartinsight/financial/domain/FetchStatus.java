package com.dartinsight.financial.domain;

/** 재무제표 API를 부른 결과. 013은 실패가 아니라 NO_DATA다. 호출 실패는 저장하지 않는다. */
public enum FetchStatus {
    OK, NO_DATA
}
