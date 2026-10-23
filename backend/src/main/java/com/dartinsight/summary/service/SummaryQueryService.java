package com.dartinsight.summary.service;

import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.service.AnalysisResultService;
import com.dartinsight.summary.domain.SummaryItemRow;
import com.dartinsight.summary.repository.SummaryStore.StoredItem;
import com.dartinsight.summary.repository.SummaryStore;
import java.util.List;
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

    private SummaryEntry entry(Long analysisId, StoredItem stored) {
        if (stored.financialChangeId() != null) {
            String sjDiv = resultService.financialSjDiv(stored.financialChangeId()).orElse(null);
            return new SummaryEntry(stored.itemNo(), stored.row(), SummaryEntry.FINANCIAL, stored.financialChangeId(),
                    sjDiv);
        }
        Integer changeNo = stored.row().textChangeNo();
        Long changeId = changeNo == null ? null : resultService.textChangeId(analysisId, changeNo).orElse(null);
        return new SummaryEntry(stored.itemNo(), stored.row(), SummaryEntry.TEXT, changeId, null);
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
     */
    public record SummaryEntry(int itemNo, SummaryItemRow row, String targetType, Long changeId, String sjDiv) {

        static final String FINANCIAL = "FINANCIAL";
        static final String TEXT = "TEXT";
    }
}
