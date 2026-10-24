package com.dartinsight.explanation.dto;

import com.dartinsight.explanation.domain.ExplanationStatus;
import com.dartinsight.explanation.domain.TextExplanationRecord;
import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 문장 변경 한 줄 풀이(docs/api-spec.md POST /api/analyses/{analysisId}/text-changes/{changeId}/explanations).
 *
 * @param sentence 풀이. OK가 아니면 null
 * @param message  풀이가 없을 때의 사유. OK면 null
 * @param evidence 풀이가 인용한 원문 위치
 * @param ai       AI 문장일 때만
 * @param cached   이미 저장된 풀이를 돌려줬으면 true
 */
public record TextExplanationResponse(Long changeId, ExplanationStatus status, String sentence, String message,
        List<Evidence> evidence, AiInfo ai, boolean cached) {

    /**
     * @param currentRceptNo  분석의 현재 보고서(근거의 side를 정한다)
     * @param previousRceptNo 분석의 비교 보고서
     */
    public static TextExplanationResponse of(Long changeId, TextExplanationRecord row, String currentRceptNo,
            String previousRceptNo, boolean cached) {
        boolean ok = row.status() == ExplanationStatus.OK;
        List<Evidence> evidence = ok
                ? row.evidenceIds().stream().map(id -> Evidence.of(id, currentRceptNo, previousRceptNo)).toList()
                : List.of();
        AiInfo ai = ok && row.model() != null ? new AiInfo(row.model(), row.promptVersion(), row.generatedAt()) : null;
        return new TextExplanationResponse(changeId, row.status(), ok ? row.sentence() : null,
                ok ? null : row.reviewReason(), evidence, ai, cached);
    }

    /** @param side current·previous. 분석의 두 보고서가 아니면 null */
    public record Evidence(String side, String rceptNo, Integer blockNo, String evidenceId) {

        static Evidence of(String evidenceId, String currentRceptNo, String previousRceptNo) {
            int mark = evidenceId.indexOf("#B");
            if (mark < 0) {
                return new Evidence(null, null, null, evidenceId);
            }
            String rceptNo = evidenceId.substring(0, mark);
            String side = rceptNo.equals(currentRceptNo) ? "current"
                    : rceptNo.equals(previousRceptNo) ? "previous" : null;
            Integer blockNo;
            try {
                blockNo = Integer.valueOf(evidenceId.substring(mark + 2));
            } catch (NumberFormatException e) {
                blockNo = null;
            }
            return new Evidence(side, rceptNo, blockNo, evidenceId);
        }
    }

    public record AiInfo(String model, String promptVersion,
            @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss") LocalDateTime generatedAt) {
    }
}
