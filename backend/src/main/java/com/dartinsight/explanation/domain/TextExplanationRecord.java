package com.dartinsight.explanation.domain;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 저장된 한 줄 풀이 하나(docs/erd.md text_change_explanation).
 *
 * @param id           저장 전이면 null
 * @param changeNo     text_change.change_no
 * @param sentence     AI 풀이. OK가 아니면 null
 * @param evidenceIds  풀이가 인용한 근거 ID({접수번호}#B{블록 번호})
 * @param reviewReason 검토 필요·원문 없음 사유. OK면 null
 * @param blockedRules 표현 검사(5.5)에 걸린 규칙 ID
 */
public record TextExplanationRecord(Long id, Long analysisId, int changeNo, ExplanationStatus status,
        String sentence, List<String> evidenceIds, String reviewReason, List<String> blockedRules, String model,
        String promptVersion, LocalDateTime generatedAt, String traceId, LocalDateTime createdAt) {

    public TextExplanationRecord withId(Long newId) {
        return new TextExplanationRecord(newId, analysisId, changeNo, status, sentence, evidenceIds, reviewReason,
                blockedRules, model, promptVersion, generatedAt, traceId, createdAt);
    }
}
