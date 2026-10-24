package com.dartinsight.question.dto;

/** 질문 요청. 앞뒤 공백을 뺀 2~200자(검사는 QuestionService) */
public record QuestionRequest(String question) {
}
