package com.dartinsight.analysis.dto;

import com.dartinsight.analysis.domain.TextChangeListing;
import com.dartinsight.analysis.domain.TextChangeListing.RowDiff;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;
import java.util.Map;

/** AI 서버 문장 비교 응답(POST /internal/text-changes). docs/api-spec.md 3절 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record TextChangeDiffResponse(String diffVersion, String priorityVersion, String listVersion,
        List<String> missingFields, Map<String, Integer> sectionCounts, List<Change> changes) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Change(String changeType, String blockType, String sectionStatus, String sectionTitle,
            String sectionPath, Position previous, Position current, Boolean numbersOnly, Double similarity,
            String reviewReason, PriorityResult priority, String previousSectionPath, String listGroup, String field,
            Boolean raisedFromNote, String noteScope, RowDiffResult rowDiff) {

        /** @param previousRceptNo 짝지은 이전 표의 위치에 붙일 이전 보고서 접수번호 */
        public TextChangeListing listing(String version, String previousRceptNo) {
            return new TextChangeListing(listGroup, field, Boolean.TRUE.equals(raisedFromNote), noteScope,
                    rowDiff == null ? null : rowDiff.toRowDiff(previousRceptNo), version);
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record PriorityResult(String level, Integer score, List<String> reasons) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Position(Integer sectionNo, Integer blockNo) {
    }

    /** pairedPrevious만 AI 서버가 접수번호 없이 준다 */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record RowDiffResult(String status, String keyColumn, RowDiff.Counts counts, Position pairedPrevious,
            List<RowDiff.ChangedRow> changedRows, List<String> addedKeys, List<String> missingKeys) {

        RowDiff toRowDiff(String previousRceptNo) {
            RowDiff.PairedPrevious paired = pairedPrevious == null ? null : new RowDiff.PairedPrevious(
                    previousRceptNo, pairedPrevious.sectionNo(), pairedPrevious.blockNo());
            return new RowDiff(status, keyColumn, counts, paired, changedRows == null ? List.of() : changedRows,
                    addedKeys, missingKeys);
        }
    }
}
