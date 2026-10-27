package com.dartinsight.explanation.dto;

import com.dartinsight.document.domain.EvidenceRef;
import com.dartinsight.explanation.domain.ExplanationStatus;
import com.dartinsight.explanation.domain.TextExplanationRecord;
import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * 문장 변경 한 줄 풀이(docs/api-spec.md POST /api/analyses/{analysisId}/text-changes/{changeId}/explanations).
 *
 * @param sentence 풀이. OK가 아니면 null
 * @param message  풀이가 없을 때의 사유. OK면 null
 * @param evidence    풀이가 인용한 원문 위치
 * @param aiGenerated sentence가 AI가 만든 문장이면 true(OK). 화면은 이 값으로 'AI 생성'을 표시한다(5.6)
 * @param ai          AI 문장일 때만
 * @param cached   이미 저장된 풀이를 돌려줬으면 true
 */
public record TextExplanationResponse(Long changeId, ExplanationStatus status, String sentence, String message,
        List<Evidence> evidence, boolean aiGenerated, AiInfo ai, boolean cached) {

    /**
     * @param located 근거 ID → 원문 위치(섹션 번호·경로). 찾지 못한 근거는 위치 없이 접수번호·블록 번호만
     * @param currentRceptNo  분석의 현재 보고서(근거의 side를 정한다)
     * @param previousRceptNo 분석의 비교 보고서
     */
    public static TextExplanationResponse of(Long changeId, TextExplanationRecord row, Map<String, Location> located,
            String currentRceptNo, String previousRceptNo, boolean cached) {
        boolean ok = row.status() == ExplanationStatus.OK;
        List<Evidence> evidence = ok
                ? row.evidenceIds().stream()
                        .map(id -> Evidence.of(id, located.get(id), currentRceptNo, previousRceptNo)).toList()
                : List.of();
        AiInfo ai = ok && row.model() != null ? new AiInfo(row.model(), row.promptVersion(), row.generatedAt()) : null;
        return new TextExplanationResponse(changeId, row.status(), ok ? row.sentence() : null,
                ok ? null : row.reviewReason(), evidence, ok, ai, cached);
    }

    /** 근거 블록이 속한 섹션(그 보고서 원문의 섹션 번호와 상위부터 이은 제목) */
    public record Location(Integer sectionNo, String sectionPath) {
    }

    /**
     * 풀이가 인용한 원문 위치. 화면이 원문 탭을 그 블록에서 연다.
     *
     * @param side        current·previous. 분석의 두 보고서가 아니면 null
     * @param sectionNo   블록이 속한 섹션 번호. 찾지 못했으면 null
     * @param sectionPath 그 섹션의 경로. 찾지 못했으면 null
     */
    public record Evidence(String side, String rceptNo, Integer sectionNo, Integer blockNo, String sectionPath,
            String evidenceId) {

        static Evidence of(String evidenceId, Location location, String currentRceptNo, String previousRceptNo) {
            Integer sectionNo = location == null ? null : location.sectionNo();
            String sectionPath = location == null ? null : location.sectionPath();
            EvidenceRef ref = EvidenceRef.parse(evidenceId);
            String rceptNo = ref.rceptNo();
            String side = rceptNo == null ? null
                    : rceptNo.equals(currentRceptNo) ? "current"
                    : rceptNo.equals(previousRceptNo) ? "previous" : null;
            return new Evidence(side, rceptNo, sectionNo, ref.blockNo(), sectionPath, evidenceId);
        }
    }

    public record AiInfo(String model, String promptVersion,
            @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss") LocalDateTime generatedAt) {
    }
}
