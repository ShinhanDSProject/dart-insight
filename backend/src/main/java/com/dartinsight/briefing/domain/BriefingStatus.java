package com.dartinsight.briefing.domain;

/**
 * AI 기업 브리핑 결과(docs/api-spec.md GET /api/companies/{corpCode}/briefing, ADR-0025).
 * <ul>
 *   <li>GENERATED: 근거를 확인한 문장이 있음(저장)</li>
 *   <li>REVIEW_NEEDED: 다시 만들어도 근거·숫자·표현 검사를 통과하지 못함(저장, 문장 없음)</li>
 *   <li>NOT_AVAILABLE: 브리핑을 만들 자료가 없음(저장하지 않음)</li>
 * </ul>
 */
public enum BriefingStatus {
    GENERATED, REVIEW_NEEDED, NOT_AVAILABLE
}
