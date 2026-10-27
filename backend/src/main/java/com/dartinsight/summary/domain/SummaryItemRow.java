package com.dartinsight.summary.domain;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 요약 한 줄(저장 전).
 *
 * @param kind              FINANCIAL(재무 수치) 또는 TEXT(문장 변화)
 * @param status            SHOWN 요약에 보임, REVIEW_NEEDED 근거·숫자 확인을 통과하지 못해 요약에서 뺌
 * @param factSentence      코드가 만든 사실 문장(재무 수치). 문장 변화면 null
 * @param aiText            AI가 만든 문장(문장 변화의 요약, 재무 수치의 설명). 없으면 null
 * @param explanationStatus 재무 수치의 설명: FOUND, NOT_FOUND('확인된 설명 없음'), REVIEW_NEEDED. 문장 변화면 null
 * @param evidenceIds       aiText의 근거 원문 위치({접수번호}#B{블록 번호})
 * @param financialIndex    재무 수치 결과 목록 안의 순서(저장할 때 financial_change.id로 바꾼다)
 * @param textChangeNo      문장 변경 번호(text_change.change_no)
 * @param reviewReason      검토 필요 사유. SHOWN인 재무 수치면 코드가 설명 등급을 낮춘 사유(없으면 null)
 * @param blockedRules      투자 권유성 표현 검사(5.5)에 걸려 내보내지 않았으면 걸린 규칙 ID. 아니면 빈 목록
 * @param explanationGrade  재무 수치 설명 등급(ADR-0015): STATED, RELATED, NONE. 문장 변화·REVIEW_NEEDED·등급 기능 전이면 null
 * @param quote             등급의 근거로 후보 원문에서 그대로 옮긴 인용문. NONE이면 null
 * @param quoteEvidenceId   인용 위치({접수번호}#B{블록 번호}). NONE이면 null
 */
public record SummaryItemRow(String kind, String status, String factSentence, String aiText,
        String explanationStatus, List<String> evidenceIds, Integer financialIndex, Integer textChangeNo,
        String reviewReason, String model, String promptVersion, LocalDateTime generatedAt,
        List<String> blockedRules, String explanationGrade, String quote, String quoteEvidenceId) {

    public static final String FINANCIAL = "FINANCIAL";
    public static final String TEXT = "TEXT";
    public static final String SHOWN = "SHOWN";
    public static final String REVIEW_NEEDED = "REVIEW_NEEDED";
    public static final String FOUND = "FOUND";
    public static final String NOT_FOUND = "NOT_FOUND";
    public static final String STATED = "STATED";
    public static final String RELATED = "RELATED";
    public static final String NONE = "NONE";

    /** 설명 등급이 없는 한 줄(문장 변화, 설명이 검토 필요인 재무 수치) */
    public SummaryItemRow(String kind, String status, String factSentence, String aiText,
            String explanationStatus, List<String> evidenceIds, Integer financialIndex, Integer textChangeNo,
            String reviewReason, String model, String promptVersion, LocalDateTime generatedAt,
            List<String> blockedRules) {
        this(kind, status, factSentence, aiText, explanationStatus, evidenceIds, financialIndex, textChangeNo,
                reviewReason, model, promptVersion, generatedAt, blockedRules, null, null, null);
    }

    /** 근거·숫자 확인을 통과하지 못해 요약에서 뺀 줄인지 */
    public boolean reviewNeeded() {
        return REVIEW_NEEDED.equals(status);
    }

    /** 재무 수치의 설명만 검토 필요인지(수치 문장은 요약에 보임) */
    public boolean explanationReviewNeeded() {
        return REVIEW_NEEDED.equals(explanationStatus);
    }

    /** AI가 만든 문장이 있는지('AI 생성' 표시) */
    public boolean aiGenerated() {
        return aiText != null;
    }
}
