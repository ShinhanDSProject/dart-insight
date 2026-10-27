package com.dartinsight.question.domain;

/**
 * 저장된 답이 인용한 원문 문단 하나(판단 노트에 담을 때, #432).
 *
 * @param question 저장된 질문 글
 * @param source   저장된 원문에서 다시 푼 문단 위치와 글(text는 문단 전체)
 */
public record CitedSource(long questionId, String question, QuestionSource source) {
}
