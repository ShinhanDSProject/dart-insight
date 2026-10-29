package com.dartinsight.summary.service;

import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.domain.FinancialChange;
import com.dartinsight.analysis.domain.TextChange;
import com.dartinsight.analysis.service.AnalysisResultService;
import com.dartinsight.summary.domain.LlmCallUsage;
import com.dartinsight.summary.domain.SummaryItemRow;
import com.dartinsight.summary.domain.SummaryLens;
import com.dartinsight.summary.repository.SummaryStore.StoredItem;
import com.dartinsight.summary.repository.SummaryStore;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 요약·설명(3.2) 조회. 완료된 분석의 저장된 요약 항목과 각 항목이 가리키는 변경을 돌려준다. */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class SummaryQueryService {

    private final AnalysisResultService resultService;
    private final SummaryStore summaryStore;

    /** 완료된 분석의 요약 항목. 완료되지 않았으면 409 */
    public StoredSummary summary(Long analysisId) {
        Analysis analysis = resultService.completed(analysisId);
        List<SummaryEntry> entries = summaryStore.items(analysisId).stream()
                .map(stored -> entry(analysisId, stored)).toList();
        return new StoredSummary(analysis, entries);
    }

    /** 요약에 보인 그 문장 변경의 AI 문장(text_change_no가 같은 TEXT 항목). 없으면 빈 값. 분석 상태는 보지 않는다 */
    public Optional<SummaryItemRow> shownText(Long analysisId, int changeNo) {
        return summaryStore.items(analysisId).stream().map(StoredItem::row)
                .filter(r -> SummaryItemRow.TEXT.equals(r.kind()) && SummaryItemRow.SHOWN.equals(r.status())
                        && r.aiText() != null && Integer.valueOf(changeNo).equals(r.textChangeNo()))
                .findFirst();
    }

    /** called_at이 [from, to)인 LLM 호출 집계(요약·답·풀이 호출 모두). AI 사용 현황 */
    public LlmCallUsage llmCallUsage(LocalDateTime from, LocalDateTime to) {
        return summaryStore.llmCallUsage(from, to);
    }

    private SummaryEntry entry(Long analysisId, StoredItem stored) {
        if (stored.financialChangeId() != null) {
            Optional<FinancialChange> change = resultService.financialChange(stored.financialChangeId());
            return new SummaryEntry(stored.itemNo(), stored.row(), SummaryEntry.FINANCIAL, stored.financialChangeId(),
                    change.map(FinancialChange::getSjDiv).orElse(null),
                    change.map(SummaryLens::of).orElse(SummaryLens.OTHER));
        }
        Integer changeNo = stored.row().textChangeNo();
        Optional<TextChange> change = changeNo == null ? Optional.empty()
                : resultService.textChange(analysisId, changeNo);
        return new SummaryEntry(stored.itemNo(), stored.row(), SummaryEntry.TEXT,
                change.map(TextChange::id).orElse(null), null, change.map(SummaryLens::of).orElse(SummaryLens.OTHER));
    }

    public record StoredSummary(Analysis analysis, List<SummaryEntry> entries) {
    }

    /**
     * 저장된 요약 항목 하나와 그 항목이 가리키는 변경.
     *
     * @param itemNo     요약 안 항목 번호
     * @param targetType FINANCIAL(재무 수치의 계정) 또는 TEXT(문장 변경)
     * @param changeId   가리키는 변경 ID. 찾지 못했으면 null
     * @param sjDiv      재무 수치면 재무제표 구분. 문장 변경이거나 찾지 못했으면 null
     * @param lens       투자자 관점(FS-64). 가리키는 변경을 찾지 못했으면 OTHER
     */
    public record SummaryEntry(int itemNo, SummaryItemRow row, String targetType, Long changeId, String sjDiv,
            SummaryLens lens) {

        static final String FINANCIAL = "FINANCIAL";
        static final String TEXT = "TEXT";
    }
}
