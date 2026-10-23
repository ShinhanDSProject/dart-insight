package com.dartinsight.analysis.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;
import java.util.Map;

/** AI 서버 문장 비교 응답(POST /internal/text-changes). docs/api-spec.md 3절 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record TextChangeDiffResponse(String diffVersion, String priorityVersion, Map<String, Integer> sectionCounts,
        List<Change> changes) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Change(String changeType, String blockType, String sectionStatus, String sectionTitle,
            String sectionPath, Position previous, Position current, Boolean numbersOnly, Double similarity,
            String reviewReason, PriorityResult priority) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record PriorityResult(String level, Integer score, List<String> reasons) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Position(Integer sectionNo, Integer blockNo) {
    }
}
