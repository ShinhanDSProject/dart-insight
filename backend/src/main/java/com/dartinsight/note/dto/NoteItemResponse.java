package com.dartinsight.note.dto;

import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.note.domain.JudgmentNoteItem;
import com.dartinsight.note.domain.NoteKind;
import com.dartinsight.report.domain.DartLinks;
import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalDateTime;

/** 노트 항목 하나(docs/api-spec.md NoteItem). label·text는 담을 때의 사본이다. */
public record NoteItemResponse(
        long itemId,
        String corpCode,
        NoteKind kind,
        String label,
        String text,
        String changeType,
        String memo,
        Source source,
        boolean outdated,
        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss") LocalDateTime createdAt,
        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss") LocalDateTime updatedAt) {

    /** 원래 위치. 결과 화면의 그 근거와 DART 원문으로 돌아간다 */
    public record Source(Long analysisId, String analysisVersion, Long changeId, String sjDiv, String rceptNo,
            Integer sectionNo, Integer blockNo, String dartUrl) {
    }

    public static NoteItemResponse from(JudgmentNoteItem item) {
        Source source = new Source(item.getAnalysisId(), item.getAnalysisVersion(), item.getChangeId(),
                item.getSjDiv(), item.getRceptNo(), item.getSectionNo(), item.getBlockNo(),
                item.getRceptNo() == null ? null : DartLinks.viewer(item.getRceptNo()));
        return new NoteItemResponse(item.getId(), item.getCorpCode(), item.getKind(), item.getSnapshotLabel(),
                item.getSnapshotText(), item.getChangeType(), item.getMemo(), source,
                item.isOutdated(Analysis.CURRENT_VERSION), item.getCreatedAt(), item.getUpdatedAt());
    }
}
