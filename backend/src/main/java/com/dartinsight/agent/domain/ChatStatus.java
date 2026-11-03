package com.dartinsight.agent.domain;

/** 채팅 답 상태(docs/api-spec.md POST /api/analyses/{analysisId}/chat-messages) */
public enum ChatStatus {
    /** 답이 있음 */
    ANSWERED,
    /** 실행에 성공한 Tool 결과에 관련 자료가 없음('확인된 설명 없음') */
    NOT_FOUND,
    /** 투자 판단 요청이라 답하지 않음 */
    OUT_OF_SCOPE,
    /** 답이 근거·숫자·표현 검사나 backend 근거 확인을 통과하지 못함 */
    REVIEW_NEEDED,
    /** 왕복·시간 상한을 넘음 */
    INCOMPLETE
}
