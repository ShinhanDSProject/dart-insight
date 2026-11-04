package com.dartinsight.agent.domain;

/**
 * 채팅 안에서 근거 질문 Tool이 만든 질문(analysis_question). 응답의 questionId와, 노트에 담기 확인 액션의
 * AI 답 인용(ANSWER_CITATION)이 이 채팅의 질문·인용인지 확인하는 데 쓴다.
 *
 * @param citationCount 그 답이 인용한 원문 수(인용 번호는 1부터 이 수까지)
 * @param answered      근거 질문이 답했는지(ANSWERED). 답하지 못한 질문은 평가할 답이 없어 응답 questionId로 내보내지 않는다
 */
public record AskedQuestion(long id, int citationCount, boolean answered) {

    public boolean hasCitation(long citationNo) {
        return citationNo >= 1 && citationNo <= citationCount;
    }
}
