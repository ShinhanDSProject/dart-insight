package com.dartinsight.note.dto;

import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.disclosure.domain.Disclosure;
import com.dartinsight.note.domain.JudgmentNoteItem;
import com.dartinsight.note.domain.NoteFollowupMatcher;
import com.dartinsight.note.domain.NoteFollowupMatcher.MatchedDisclosure;
import com.dartinsight.note.domain.NoteKind;
import com.dartinsight.report.domain.DartLinks;
import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** 노트 항목 하나(docs/api-spec.md NoteItem). label·text·question(AI 답 인용만)은 담을 때의 사본이다. */
public record NoteItemResponse(
        long itemId,
        String corpCode,
        NoteKind kind,
        String label,
        String text,
        String question,
        String changeType,
        String memo,
        Source source,
        List<RelatedDisclosure> relatedDisclosures,
        boolean outdated,
        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss") LocalDateTime createdAt,
        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss") LocalDateTime updatedAt) {

    /**
     * 원래 위치. 결과 화면의 그 근거와 DART 원문으로 돌아간다.
     *
     * @param questionId AI 답 인용만
     * @param side       AI 답 인용만. 원문 확인 탭의 보고서 쪽(current·previous)
     */
    public record Source(Long analysisId, String analysisVersion, Long changeId, String sjDiv, String rceptNo,
            Integer sectionNo, Integer blockNo, Long questionId, String side, String dartUrl) {
    }

    /** 근거 보고서 이후에 나온 관련 후속 공시(#504) */
    public record RelatedDisclosure(String rceptNo, String reportName, LocalDate rceptDt, String matchLabel,
            String dartUrl) {

        static RelatedDisclosure from(MatchedDisclosure matched) {
            Disclosure disclosure = matched.disclosure();
            return new RelatedDisclosure(
                    disclosure.rceptNo(),
                    disclosure.displayName(),
                    disclosure.rceptDt(),
                    matched.matchLabel(),
                    DartLinks.viewer(disclosure.rceptNo()));
        }
    }

    public static NoteItemResponse from(JudgmentNoteItem item) {
        return from(item, List.of());
    }

    public static NoteItemResponse from(JudgmentNoteItem item, List<Disclosure> disclosures) {
        Source source = new Source(item.getAnalysisId(), item.getAnalysisVersion(), item.getChangeId(),
                item.getSjDiv(), item.getRceptNo(), item.getSectionNo(), item.getBlockNo(), item.getQuestionId(),
                item.getDocSide(), item.getRceptNo() == null ? null : DartLinks.viewer(item.getRceptNo()));
        List<RelatedDisclosure> related = NoteFollowupMatcher.relatedDisclosures(item, disclosures).stream()
                .map(RelatedDisclosure::from)
                .toList();
        return new NoteItemResponse(item.getId(), item.getCorpCode(), item.getKind(), item.getSnapshotLabel(),
                item.getSnapshotText(), item.getSnapshotQuestion(), item.getChangeType(), item.getMemo(), source,
                related, item.isOutdated(Analysis.CURRENT_VERSION), item.getCreatedAt(), item.getUpdatedAt());
    }
}
