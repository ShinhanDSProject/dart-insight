package com.dartinsight.summary;

import com.dartinsight.analysis.Analysis;
import com.dartinsight.common.web.ApiPaths;
import com.dartinsight.document.DocumentBlock;
import com.dartinsight.document.DocumentService;
import com.dartinsight.document.ReportDocument;
import com.dartinsight.summary.SummaryQueryService.StoredSummary;
import com.dartinsight.summary.SummaryQueryService.SummaryEntry;
import com.dartinsight.summary.SummaryResponse.AiInfo;
import com.dartinsight.summary.SummaryResponse.EvidenceView;
import com.dartinsight.summary.SummaryResponse.ItemView;
import com.dartinsight.summary.SummaryResponse.ReviewView;
import com.dartinsight.summary.SummaryResponse.Target;
import com.dartinsight.summary.SummaryStore.StoredItem;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 요약·설명(3.2). 화면 W-03 ①. 근거를 확인한 항목만 요약에 보이고, 확인하지 못한 항목은 '검토 필요'로 따로 센다.
 * AI가 만든 문장에는 aiGenerated와 모델·프롬프트 버전·생성 시각이 함께 있다.
 */
@RestController
@RequestMapping(ApiPaths.ANALYSIS_SUMMARY)
public class SummaryController {

    private final SummaryQueryService queryService;
    private final DocumentService documentService;

    public SummaryController(SummaryQueryService queryService, DocumentService documentService) {
        this.queryService = queryService;
        this.documentService = documentService;
    }

    @GetMapping
    public SummaryResponse summary(@PathVariable Long analysisId) {
        StoredSummary summary = queryService.summary(analysisId);
        Analysis analysis = summary.analysis();
        Map<String, Optional<ReportDocument>> documents = new HashMap<>();
        List<ItemView> shown = new ArrayList<>();
        List<ReviewView> review = new ArrayList<>();
        for (SummaryEntry entry : summary.entries()) {
            StoredItem stored = entry.stored();
            SummaryItemRow row = stored.row();
            Target target = new Target(entry.targetType(), entry.changeId(), entry.sjDiv());
            if (SummaryItemRow.REVIEW_NEEDED.equals(row.status())) {
                review.add(new ReviewView(stored.itemNo(), row.kind(), target, row.reviewReason(),
                        row.blockedRules()));
                continue;
            }
            if (SummaryItemRow.REVIEW_NEEDED.equals(row.explanationStatus())) {
                review.add(new ReviewView(stored.itemNo(), row.kind(), target,
                        "설명의 근거를 확인하지 못했어요. " + (row.reviewReason() == null ? "" : row.reviewReason()),
                        row.blockedRules()));
            }
            List<EvidenceView> evidence = row.evidenceIds().stream()
                    .map(id -> evidence(analysis, id, documents)).toList();
            shown.add(new ItemView(stored.itemNo(), row.kind(), target, row.factSentence(), row.aiText(),
                    row.aiGenerated(), row.explanationStatus(), evidence, AiInfo.from(row)));
        }
        return new SummaryResponse(analysisId, analysis.getSummaryStatus(), analysis.getSummaryMessage(),
                analysis.getTextStatus(), shown, review.size(), review);
    }

    /** 근거 ID({접수번호}#B{블록 번호})를 화면에서 열 수 있는 위치로 푼다. */
    private EvidenceView evidence(Analysis analysis, String evidenceId, Map<String, Optional<ReportDocument>> docs) {
        int mark = evidenceId.indexOf("#B");
        if (mark < 0) {
            return new EvidenceView(evidenceId, null, null, null, null);
        }
        String rceptNo = evidenceId.substring(0, mark);
        Integer blockNo;
        try {
            blockNo = Integer.valueOf(evidenceId.substring(mark + 2));
        } catch (NumberFormatException e) {
            return new EvidenceView(evidenceId, null, rceptNo, null, null);
        }
        String side = rceptNo.equals(analysis.getCurrentRceptNo()) ? "current"
                : rceptNo.equals(analysis.getPreviousRceptNo()) ? "previous" : null;
        Optional<ReportDocument> document = docs.computeIfAbsent(rceptNo, documentService::find);
        if (document.isPresent() && restructuredAfter(document.get(), analysis)) {
            // 분석 뒤에 원문을 다시 구조화했으면 블록 번호가 다른 글을 가리킬 수 있어 위치를 주지 않는다
            return new EvidenceView(evidenceId, side, rceptNo, null, null);
        }
        Integer sectionNo = document.flatMap(d -> documentService.block(d, blockNo)).map(DocumentBlock::sectionNo)
                .orElse(null);
        return new EvidenceView(evidenceId, side, rceptNo, sectionNo, blockNo);
    }

    private static boolean restructuredAfter(ReportDocument document, Analysis analysis) {
        return document.getStructuredAt() != null && analysis.getCompletedAt() != null
                && document.getStructuredAt().isAfter(analysis.getCompletedAt());
    }
}
