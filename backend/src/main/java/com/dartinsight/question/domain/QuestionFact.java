package com.dartinsight.question.domain;

/**
 * 질문에 나온 계정의 사실 문장. 숫자는 코드가 계산했다(FinancialFacts).
 *
 * @param ref      답 안의 표시(F1, F2…)
 * @param changeId financial_change.id
 */
public record QuestionFact(String ref, Long changeId, String sjDiv, String accountName, String sentence) {
}
