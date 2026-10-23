package com.dartinsight.summary.domain;

/**
 * 요약(3.2) 상태.
 * <ul>
 *   <li>COMPLETED: 고른 항목을 모두 근거와 함께 요약함</li>
 *   <li>PARTIAL: 일부 항목이 근거·숫자 확인을 통과하지 못해 '검토 필요'로 뺌</li>
 *   <li>EMPTY: 요약할 변화가 없음(변화가 없거나 비교하지 못함)</li>
 * </ul>
 * LLM을 부를 수 없으면 요약 상태를 남기지 않고 분석을 실패로 끝낸다(0.7).
 */
public enum SummaryStatus {
    COMPLETED, PARTIAL, EMPTY
}
