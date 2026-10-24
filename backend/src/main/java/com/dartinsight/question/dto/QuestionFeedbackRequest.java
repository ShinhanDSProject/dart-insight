package com.dartinsight.question.dto;

/**
 * 답 평가 요청(docs/api-spec.md PUT …/questions/{questionId}/feedback). 검사는 QuestionService.
 *
 * @param helpful 도움이 됐으면 true. 필수
 * @param reason  helpful이 false일 때만: WRONG_SOURCE·NOT_ANSWERED·HARD_TO_READ·OTHER 또는 null
 */
public record QuestionFeedbackRequest(Boolean helpful, String reason) {
}
