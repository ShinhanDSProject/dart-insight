package com.dartinsight.note.service;

import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.domain.FinancialChange;
import com.dartinsight.analysis.domain.TextChangeRow;
import com.dartinsight.analysis.domain.TextChangeRow.Side;
import com.dartinsight.analysis.service.AnalysisResultService;
import com.dartinsight.analysis.service.AnalysisResultService.CompletedChange;
import com.dartinsight.analysis.service.TextEvidenceService;
import com.dartinsight.analysis.service.TextEvidenceService.SourceEvidence;
import com.dartinsight.analysis.service.TextEvidenceService.TextEvidence;
import com.dartinsight.note.domain.FinancialNoteText;
import com.dartinsight.note.domain.NoteKind;
import com.dartinsight.note.domain.NoteSnapshot;
import com.dartinsight.question.domain.CitedSource;
import com.dartinsight.question.domain.QuestionSource;
import com.dartinsight.question.service.QuestionService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 담을 근거를 저장된 분석 결과·질문 답에서 찾아 사본을 만든다(ADR-0034). 화면이 보낸 글은 쓰지 않는다.
 * 재무 값의 이름·문장은 {@link FinancialNoteText}가 저장된 계산 결과로 만든다(LLM을 쓰지 않음).
 */
@Service
@RequiredArgsConstructor
public class NoteSnapshotFactory {
    private static final String REVIEW_TEXT = "검토 필요: 두 보고서의 항목을 짝짓지 못했어요.";
    private static final String UNKNOWN_SECTION = "섹션 확인 안 됨";

    private final AnalysisResultService resultService;
    private final TextEvidenceService evidenceService;
    private final QuestionService questionService;

    public NoteSnapshot create(NoteKind kind, long analysisId, long changeId) {
        return switch (kind) {
            case FINANCIAL_CHANGE -> financial(resultService.completedChange(analysisId, changeId));
            case TEXT_CHANGE -> text(resultService.completed(analysisId), evidenceService.evidence(analysisId, changeId));
            case ANSWER_CITATION -> throw new IllegalArgumentException("AI 답 인용은 answerCitation으로 만든다");
        };
    }

    /**
     * AI 답의 인용 하나. 이름은 섹션 경로, 글은 저장된 원문의 그 문단, 질문은 저장된 질문 글이다(#432).
     * 원래 위치는 원문 확인 탭(보고서 쪽·섹션·블록)이다.
     */
    public NoteSnapshot answerCitation(long analysisId, long questionId, int citationNo) {
        Analysis analysis = resultService.completed(analysisId);
        CitedSource cited = questionService.citedSource(analysis, questionId, citationNo);
        QuestionSource source = cited.source();
        String label = source.sectionPath() == null || source.sectionPath().isBlank() ? UNKNOWN_SECTION
                : source.sectionPath();
        return new NoteSnapshot(analysis.getCorpCode(), NoteKind.ANSWER_CITATION, analysis.getId(),
                analysis.getAnalysisVersion(), null, null, source.rceptNo(), source.sectionNo(), source.blockNo(),
                null, label, source.text(), cited.questionId(), cited.question(), source.side());
    }

    private static NoteSnapshot financial(CompletedChange result) {
        Analysis analysis = result.analysis();
        FinancialChange change = result.change();
        String rceptNo = change.getCurrentRceptNo() != null ? change.getCurrentRceptNo() : analysis.getCurrentRceptNo();
        return new NoteSnapshot(analysis.getCorpCode(), NoteKind.FINANCIAL_CHANGE, analysis.getId(),
                analysis.getAnalysisVersion(), change.getId(), change.getSjDiv(), rceptNo, null, null, null,
                FinancialNoteText.label(change), FinancialNoteText.text(change));
    }

    private static NoteSnapshot text(Analysis analysis, TextEvidence evidence) {
        TextChangeRow row = evidence.change().row();
        boolean current = row.current() != null;
        Side side = current ? row.current() : row.previous();
        SourceEvidence source = current ? evidence.current() : evidence.previous();
        String label = source != null && source.sectionPath() != null ? source.sectionPath() : row.sectionPath();
        String text = side != null && side.text() != null && !side.text().isBlank() ? side.text()
                : row.reviewReason() != null ? "검토 필요: " + row.reviewReason() : REVIEW_TEXT;
        return new NoteSnapshot(analysis.getCorpCode(), NoteKind.TEXT_CHANGE, analysis.getId(),
                analysis.getAnalysisVersion(), evidence.change().id(), null,
                side == null ? analysis.getCurrentRceptNo() : side.rceptNo(),
                side == null ? null : side.sectionNo(), side == null ? null : side.blockNo(), row.changeType(),
                label == null || label.isBlank() ? UNKNOWN_SECTION : label, text);
    }
}
