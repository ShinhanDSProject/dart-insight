package com.dartinsight.relateddisclosure.domain;

/** 기간 공시 목록을 받은 결과. OK 한 건 이상 있음, NO_DATA 세 상세유형 모두 받은 줄이 없음(013) */
public enum WindowFetchStatus {
    OK,
    NO_DATA
}
