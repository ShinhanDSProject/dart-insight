package com.dartinsight.comparison;

/**
 * 비교 기준(docs/api-spec.md 공통 값). 기본값은 전년 동기(잠정안, 결정 로그 '기본 비교 기준').
 */
public enum ComparisonBasis {
    /** 전년 동기: 같은 종류의 1년 전 보고서 */
    YOY,
    /** 직전 기간: 바로 앞 정기보고서(1분기 ← 전년 사업, 반기 ← 1분기, 3분기 ← 반기, 사업 ← 3분기) */
    PREV,
    /** 직접 선택: 화면에서 목록 중에 고름 */
    CUSTOM
}
