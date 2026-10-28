package com.dartinsight.followup.domain;

/**
 * 약속과 실제 대조 결과(docs/api-spec.md GET /api/companies/{corpCode}/plan-followups, ADR-0041).
 * <ul>
 *   <li>GENERATED: 계획마다 대조가 있음(저장)</li>
 *   <li>EMPTY: 작년 보고서에서 회사 행동 계획을 찾지 못함(AI를 부르지 않음, 저장하지 않음)</li>
 *   <li>REVIEW_NEEDED: 대조가 검사를 통과하지 못함(저장) 또는 작년 전망·계획이 검토 필요(저장하지 않음)</li>
 *   <li>NOT_AVAILABLE: 대조할 자료가 없음(저장하지 않음)</li>
 * </ul>
 */
public enum PlanFollowupStatus {
    GENERATED, EMPTY, REVIEW_NEEDED, NOT_AVAILABLE
}
