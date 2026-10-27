package com.dartinsight.outlook.domain;

/**
 * 회사가 밝힌 전망·계획 결과(docs/api-spec.md GET /api/companies/{corpCode}/outlook, ADR-0039).
 * <ul>
 *   <li>GENERATED: 인용·근거를 확인한 항목이 있음(저장)</li>
 *   <li>EMPTY: 계획·전망 문장을 찾지 못함. AI가 0개로 답했으면 저장, 낱말 문단이 없어 AI를 부르지 않았으면 저장하지 않음</li>
 *   <li>REVIEW_NEEDED: 다시 만들어도 인용·근거·숫자·표현 검사를 통과하지 못함(저장, 항목 없음)</li>
 *   <li>NOT_AVAILABLE: 만들 자료가 없음(저장하지 않음)</li>
 * </ul>
 */
public enum OutlookStatus {
    GENERATED, EMPTY, REVIEW_NEEDED, NOT_AVAILABLE
}
