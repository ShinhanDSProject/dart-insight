package com.dartinsight.question.domain;

/**
 * 질문 하나의 결과(docs/api-spec.md POST /api/analyses/{analysisId}/questions).
 * <ul>
 *   <li>ANSWERED: 인용을 확인한 답이 있음</li>
 *   <li>NOT_FOUND: 두 보고서에서 관련 문단·수치를 찾지 못함</li>
 *   <li>OUT_OF_SCOPE: 매수·매도·목표주가·주가 전망 질문이라 답하지 않음</li>
 *   <li>REVIEW_NEEDED: 답이 근거·숫자·표현 검사를 통과하지 못함</li>
 * </ul>
 */
public enum QuestionStatus {
    ANSWERED, NOT_FOUND, OUT_OF_SCOPE, REVIEW_NEEDED;

    /** 화면에 보이는 안내. 답이 있으면 null */
    public String message() {
        return switch (this) {
            case ANSWERED -> null;
            case NOT_FOUND -> "두 보고서에서 질문과 관련된 문단이나 수치를 찾지 못했어요. "
                    + "다른 말로 물어보거나 문장·내용 변화에서 검색해 보세요.";
            case OUT_OF_SCOPE -> "투자 판단·주가 예측을 돕는 질문에는 답하지 않아요. 공시에 적힌 사실을 물어봐 주세요.";
            case REVIEW_NEEDED -> "근거를 확인하지 못해 답을 보여 주지 않아요. 질문을 바꾸거나 원문에서 직접 확인해 주세요.";
        };
    }
}
