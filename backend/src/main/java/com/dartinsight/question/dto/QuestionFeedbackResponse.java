package com.dartinsight.question.dto;

import com.dartinsight.question.domain.FeedbackReason;
import com.dartinsight.question.domain.QuestionFeedback;
import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalDateTime;

/**
 * 저장한 답 평가(docs/api-spec.md PUT …/questions/{questionId}/feedback).
 *
 * @param updatedAt 평가를 저장한 시각(한국 시간)
 */
public record QuestionFeedbackResponse(Long questionId, boolean helpful, FeedbackReason reason,
        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss") LocalDateTime updatedAt) {

    public static QuestionFeedbackResponse of(Long questionId, QuestionFeedback feedback) {
        return new QuestionFeedbackResponse(questionId, feedback.helpful(), feedback.reason(), feedback.at());
    }
}
