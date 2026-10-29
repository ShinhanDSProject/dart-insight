package com.dartinsight.summary.service;

import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.document.domain.DocumentBlock;
import com.dartinsight.document.domain.ReportDocument;
import com.dartinsight.document.service.DocumentService;
import com.dartinsight.document.domain.EvidenceRef;
import com.dartinsight.summary.domain.SummaryItemRow;
import com.dartinsight.summary.dto.SummaryResponse;
import com.dartinsight.summary.dto.SummaryResponse.EvidenceView;
import com.dartinsight.summary.dto.SummaryResponse.ItemView;
import com.dartinsight.summary.dto.SummaryResponse.ReviewView;
import com.dartinsight.summary.dto.SummaryResponse.Target;
import com.dartinsight.summary.service.SummaryQueryService.StoredSummary;
import com.dartinsight.summary.service.SummaryQueryService.SummaryEntry;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 요약·설명(3.2) 화면 응답. 저장된 요약 항목을 보이는 줄과 '검토 필요' 줄로 나누고, 근거 ID를 화면에서 열 수 있는
 * 위치로 푼다. 조회만 하므로 한 읽기 전용 트랜잭션에서 한다(TX-1).
 */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class SummaryViewService {

    private final SummaryQueryService queryService;
    private final DocumentService documentService;

    public SummaryResponse summary(Long analysisId) {
        StoredSummary summary = queryService.summary(analysisId);
        Analysis analysis = summary.analysis();
        Map<String, Optional<ReportDocument>> documents = new HashMap<>();
        List<ItemView> shown = new ArrayList<>();
        List<ReviewView> review = new ArrayList<>();
        for (SummaryEntry entry : summary.entries()) {
            SummaryItemRow row = entry.row();
            Target target = new Target(entry.targetType(), entry.changeId(), entry.sjDiv());
            if (row.reviewNeeded()) {
                review.add(ReviewView.of(entry.itemNo(), target, entry.lens(), row));
                continue;
            }
            if (row.explanationReviewNeeded()) {
                review.add(ReviewView.ofExplanation(entry.itemNo(), target, entry.lens(), row));
            }
            shown.add(shownItem(entry, target, analysis, documents));
        }
        return SummaryResponse.of(analysisId, analysis.getSummaryStatus(), analysis.getSummaryMessage(),
                analysis.getTextStatus(), shown, review);
    }

    private ItemView shownItem(SummaryEntry entry, Target target, Analysis analysis,
            Map<String, Optional<ReportDocument>> documents) {
        SummaryItemRow row = entry.row();
        List<EvidenceView> evidence = row.evidenceIds().stream()
                .map(id -> evidence(analysis, id, documents)).toList();
        EvidenceView quoteEvidence = row.quoteEvidenceId() == null ? null
                : evidence(analysis, row.quoteEvidenceId(), documents);
        return ItemView.of(entry.itemNo(), target, entry.lens(), row, quoteEvidence, evidence);
    }

    /** 근거 ID({접수번호}#B{블록 번호})를 화면에서 열 수 있는 위치로 푼다. */
    private EvidenceView evidence(Analysis analysis, String evidenceId, Map<String, Optional<ReportDocument>> docs) {
        EvidenceRef ref = EvidenceRef.parse(evidenceId);
        if (ref.rceptNo() == null) {
            return new EvidenceView(evidenceId, null, null, null, null);
        }
        if (ref.blockNo() == null) {
            return new EvidenceView(evidenceId, null, ref.rceptNo(), null, null);
        }
        String side = side(analysis, ref.rceptNo());
        Optional<ReportDocument> document = docs.computeIfAbsent(ref.rceptNo(), documentService::find);
        if (document.isPresent() && restructuredAfter(document.get(), analysis)) {
            // 분석 뒤에 원문을 다시 구조화했으면 블록 번호가 다른 글을 가리킬 수 있어 위치를 주지 않는다
            return new EvidenceView(evidenceId, side, ref.rceptNo(), null, null);
        }
        Integer sectionNo = document.flatMap(d -> documentService.block(d, ref.blockNo()))
                .map(DocumentBlock::sectionNo).orElse(null);
        return new EvidenceView(evidenceId, side, ref.rceptNo(), sectionNo, ref.blockNo());
    }

    /** 분석의 현재·이전 보고서 중 어느 쪽인지. 둘 다 아니면 null */
    private static String side(Analysis analysis, String rceptNo) {
        return rceptNo.equals(analysis.getCurrentRceptNo()) ? "current"
                : rceptNo.equals(analysis.getPreviousRceptNo()) ? "previous" : null;
    }

    private static boolean restructuredAfter(ReportDocument document, Analysis analysis) {
        return document.getStructuredAt() != null && analysis.getCompletedAt() != null
                && document.getStructuredAt().isAfter(analysis.getCompletedAt());
    }
}
