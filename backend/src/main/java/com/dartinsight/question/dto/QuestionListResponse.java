package com.dartinsight.question.dto;

import java.util.List;

/** 이 분석에서 한 질문·답 기록(최신 순, 최대 20개) */
public record QuestionListResponse(List<QuestionResponse> items) {
}
