package com.dartinsight.analysis;

/**
 * 문장 비교(2.5) 결과 상태. 분석이 완료돼도 문장 비교는 따로 실패할 수 있다(원문을 받지 못하는 등).
 * <ul>
 *   <li>COMPLETED: 두 원문을 끝까지 읽고 비교함</li>
 *   <li>PARTIAL: 비교했지만 원문 일부를 읽지 못했을 수 있음(메시지에 사유). 완전한 결과로 보이지 않게 한다</li>
 *   <li>FAILED: 비교하지 못함(메시지에 사유). 문장 변경이 없다는 뜻이 아니다</li>
 * </ul>
 */
public enum TextStatus {
    COMPLETED, PARTIAL, FAILED
}
