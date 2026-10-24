package com.dartinsight.explanation.domain;

/**
 * 문장 변경 한 줄 풀이의 상태(docs/api-spec.md POST .../explanations).
 * <ul>
 *   <li>OK: 근거를 확인한 풀이가 있음</li>
 *   <li>REVIEW_NEEDED: 근거·숫자·표현 검사를 통과하지 못해 풀이를 보여 주지 않음(사유를 남김)</li>
 *   <li>NO_SOURCE: 두 보고서에서 짝지은 원문이 없어 풀이하지 않음(AI를 부르지 않음)</li>
 * </ul>
 */
public enum ExplanationStatus {
    OK, REVIEW_NEEDED, NO_SOURCE
}
