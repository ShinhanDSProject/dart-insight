package com.dartinsight.relateddisclosure.domain;

/** 공시가 나온 때. DURING 접수일 ≤ 현재 보고서 기간 말일(보고 기간 중), AFTER 그 뒤 ~ 제출일(기간 후~제출 전) */
public enum DisclosureTiming {
    DURING,
    AFTER
}
