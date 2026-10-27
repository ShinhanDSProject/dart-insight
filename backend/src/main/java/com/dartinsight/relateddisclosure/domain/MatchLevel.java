package com.dartinsight.relateddisclosure.domain;

/** 연결 강도. TYPE_ONLY 제목 규칙만 걸림(같은 종류), STRONG 주요정보(DS005) 값까지 일치(내용 일치, #341) */
public enum MatchLevel {
    TYPE_ONLY,
    STRONG
}
