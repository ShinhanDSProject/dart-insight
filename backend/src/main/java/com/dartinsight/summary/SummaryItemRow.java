package com.dartinsight.summary;

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
 */
public record SummaryItemRow(String kind, String status, String factSentence, String aiText,
        String explanationStatus, List<String> evidenceIds, Integer financialIndex, Integer textChangeNo,
        String reviewReason, String model, String promptVersion, LocalDateTime generatedAt) {

    public static final String FINANCIAL = "FINANCIAL";
    public static final String TEXT = "TEXT";
    public static final String SHOWN = "SHOWN";
    public static final String REVIEW_NEEDED = "REVIEW_NEEDED";

    /** AI가 만든 문장이 있는지('AI 생성' 표시) */
    public boolean aiGenerated() {
        return aiText != null;
    }
}
