package com.dartinsight.agent.domain;

import java.util.Collection;
import java.util.List;
import java.util.Set;

/**
 * 채팅 안에서 근거 질문 Tool이 만든 질문(analysis_question). 응답의 questionId와, 노트에 담기 확인 액션의
 * AI 답 인용(ANSWER_CITATION)이 이 채팅의 질문·인용인지 확인하는 데 쓴다.
 *
 * @param citationCount 그 답이 인용한 원문 수(인용 번호는 1부터 이 수까지)
 * @param answered      근거 질문이 답했는지(ANSWERED). 답하지 못한 질문은 평가할 답이 없다
 * @param evidenceIds   그 답이 넘긴 근거 ID(원문 문단·재무 사실). 최종 답이 이 질문의 답을 썼는지 가리는 데 쓴다
 */
public record AskedQuestion(long id, int citationCount, boolean answered, Set<String> evidenceIds) {

    public AskedQuestion {
        evidenceIds = Set.copyOf(evidenceIds);
    }

    public boolean hasCitation(long citationNo) {
        return citationNo >= 1 && citationNo <= citationCount;
    }

    /**
     * 최종 답을 평가할 질문의 ID: 답한 질문 중 최종 답이 그 근거를 인용한 마지막 질문. 없으면 null.
     * 최종 답과 이어지지 않는 질문에 평가가 저장되지 않게 한다.
     *
     * @param asked 이 채팅에서 근거 질문 Tool이 만든 질문(실행 순서)
     * @param cited 최종 답이 인용한 근거 ID
     */
    public static Long ratedBy(List<AskedQuestion> asked, Collection<String> cited) {
        Long found = null;
        for (AskedQuestion question : asked) {
            if (question.answered && cited.stream().anyMatch(question.evidenceIds::contains)) {
                found = question.id;
            }
        }
        return found;
    }
}
