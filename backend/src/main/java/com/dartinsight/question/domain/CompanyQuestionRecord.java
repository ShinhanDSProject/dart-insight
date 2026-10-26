package com.dartinsight.question.domain;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 저장된 기업 질문 하나(docs/erd.md company_question, ADR-0029).
 *
 * @param id          저장 전이면 null
 * @param rceptNo     답한 보고서의 접수번호
 * @param answer      근거 표시를 [1]로 바꾼 답. ANSWERED가 아니면 null
 * @param evidenceIds 답이 인용한 근거 ID(인용 번호 순서)
 */
public record CompanyQuestionRecord(Long id, String rceptNo, String question, QuestionStatus status, String answer,
        List<String> evidenceIds, String reviewReason, List<String> blockedRules, String model,
        String promptVersion, LocalDateTime generatedAt, String traceId, LocalDateTime createdAt) {

    public CompanyQuestionRecord withId(Long newId) {
        return new CompanyQuestionRecord(newId, rceptNo, question, status, answer, evidenceIds, reviewReason,
                blockedRules, model, promptVersion, generatedAt, traceId, createdAt);
    }
}
