package com.dartinsight.question.domain;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 저장된 질문 하나(docs/erd.md analysis_question).
 *
 * @param id            저장 전이면 null
 * @param answer        근거 표시를 [1]·[F1]로 바꾼 답. ANSWERED가 아니면 null
 * @param evidenceIds   답이 인용한 근거 ID(인용 번호 순서)
 * @param factChangeIds 답이 인용한 사실의 financial_change.id(ref 번호 순서)
 * @param feedback      답 평가. 평가하지 않았으면 null
 */
public record QuestionRecord(Long id, Long analysisId, String question, QuestionStatus status, String answer,
        List<String> evidenceIds, List<Long> factChangeIds, String reviewReason, List<String> blockedRules,
        String model, String promptVersion, LocalDateTime generatedAt, String traceId, LocalDateTime createdAt,
        QuestionFeedback feedback) {

    /** 후보 문단도 사실도 없어 AI 서버에 묻지 않은 질문 */
    public static QuestionRecord notFound(Long analysisId, String question, String traceId, LocalDateTime createdAt) {
        return new QuestionRecord(null, analysisId, question, QuestionStatus.NOT_FOUND, null, List.of(), List.of(),
                null, List.of(), null, null, null, traceId, createdAt, null);
    }

    public boolean answered() {
        return status == QuestionStatus.ANSWERED;
    }

    public QuestionRecord withId(Long newId) {
        return new QuestionRecord(newId, analysisId, question, status, answer, evidenceIds, factChangeIds,
                reviewReason, blockedRules, model, promptVersion, generatedAt, traceId, createdAt, feedback);
    }
}
