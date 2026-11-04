package com.dartinsight.agent.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * 채팅 응답(docs/api-spec.md POST /api/analyses/{analysisId}/chat-messages).
 *
 * @param status     ANSWERED, NOT_FOUND, OUT_OF_SCOPE, REVIEW_NEEDED, INCOMPLETE
 * @param answer     근거 표시를 [1]·[2]로 바꾼 답. ANSWERED가 아니면 null
 * @param message    답이 없을 때의 안내
 * @param actions    화면 액션. type·label과 그 액션의 필드
 * @param crossCheck 교차 검증 결과(#581). 아니면 null
 * @param questionId 근거 질문 Tool로 저장한 질문 ID(#578). 아니면 null
 */
public record ChatMessageResponse(String status, String answer, String message, List<Citation> citations,
        List<Map<String, Object>> actions, String format, Object crossCheck, Long questionId, boolean aiGenerated,
        Ai ai) {

    /** 답이 인용한 근거 하나. 종류(kind)마다 채우는 필드가 다르다 */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Citation(int no, String kind, String evidenceId, Long changeId, String changeType, String side,
            String rceptNo, String reportName, String rceptDt, String dartUrl, Integer sectionNo, Integer blockNo,
            String sectionPath, String quote, String sjDiv, String accountName, String sentence, String grade,
            String source, String label, Object value, String unit, String currency, String corpCode,
            String corpName) {
    }

    public record Ai(String model, String promptVersion, LocalDateTime generatedAt) {
    }
}
