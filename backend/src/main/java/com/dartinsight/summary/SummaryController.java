package com.dartinsight.summary;

import com.dartinsight.analysis.Analysis;
import com.dartinsight.analysis.AnalysisResultService;
import com.dartinsight.analysis.FinancialChange;
import com.dartinsight.analysis.FinancialChangeRepository;
import com.dartinsight.analysis.TextChangeStore;
import com.dartinsight.analysis.TextStatus;
import com.dartinsight.document.DocumentBlock;
import com.dartinsight.document.DocumentService;
import com.dartinsight.document.ReportDocument;
import com.dartinsight.summary.SummaryStore.StoredItem;
import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalDateTime;
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
@RequestMapping("/api/analyses/{analysisId}/summary")
public class SummaryController {

    private final AnalysisResultService resultService;
    private final SummaryStore summaryStore;
    private final TextChangeStore textChangeStore;
    private final FinancialChangeRepository financialChangeRepository;
    private final DocumentService documentService;

    public SummaryController(AnalysisResultService resultService, SummaryStore summaryStore,
            TextChangeStore textChangeStore, FinancialChangeRepository financialChangeRepository,
            DocumentService documentService) {
        this.resultService = resultService;
        this.summaryStore = summaryStore;
        this.textChangeStore = textChangeStore;
        this.financialChangeRepository = financialChangeRepository;
        this.documentService = documentService;
    }

    @GetMapping
    public SummaryResponse summary(@PathVariable Long analysisId) {
        Analysis analysis = resultService.completed(analysisId);
        Map<String, Optional<ReportDocument>> documents = new HashMap<>();
        List<ItemView> shown = new ArrayList<>();
        List<ReviewView> review = new ArrayList<>();
        for (StoredItem stored : summaryStore.items(analysisId)) {
            SummaryItemRow row = stored.row();
            Target target = target(analysisId, stored);
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
            AiInfo ai = row.aiGenerated() ? new AiInfo(row.model(), row.promptVersion(), row.generatedAt()) : null;
            shown.add(new ItemView(stored.itemNo(), row.kind(), target, row.factSentence(), row.aiText(),
                    row.aiGenerated(), row.explanationStatus(), evidence, ai));
        }
        return new SummaryResponse(analysisId, analysis.getSummaryStatus(), analysis.getSummaryMessage(),
                analysis.getTextStatus(), shown, review.size(), review);
    }

    private Target target(Long analysisId, StoredItem stored) {
        if (stored.financialChangeId() != null) {
            String sjDiv = financialChangeRepository.findById(stored.financialChangeId())
                    .map(FinancialChange::getSjDiv).orElse(null);
            return new Target("FINANCIAL", stored.financialChangeId(), sjDiv);
        }
        Integer changeNo = stored.row().textChangeNo();
        Long changeId = changeNo == null ? null : textChangeStore.idOf(analysisId, changeNo).orElse(null);
        return new Target("TEXT", changeId, null);
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

    /** @param type FINANCIAL(재무 수치 탭의 계정) 또는 TEXT(문장 변화 탭의 변경) */
    public record Target(String type, Long changeId, String sjDiv) {
    }

    /** @param side current·previous. 분석의 보고서가 아니면 null(화면은 근거로 쓰지 않음) */
    public record EvidenceView(String evidenceId, String side, String rceptNo, Integer sectionNo, Integer blockNo) {
    }

    public record AiInfo(String model, String promptVersion,
            @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss") LocalDateTime generatedAt) {
    }

    /**
     * 요약 한 줄.
     *
     * @param factSentence      코드가 만든 사실 문장(재무 수치). 문장 변화면 null
     * @param aiText            AI가 만든 문장(문장 변화 요약, 재무 수치 설명). 없으면 null
     * @param explanationStatus 재무 수치의 설명: FOUND, NOT_FOUND('확인된 설명 없음'), REVIEW_NEEDED
     */
    public record ItemView(int itemNo, String kind, Target target, String factSentence, String aiText,
            boolean aiGenerated, String explanationStatus, List<EvidenceView> evidence, AiInfo ai) {
    }

    /** @param blockedRules 투자 권유성 표현 검사(5.5)에 걸린 규칙 ID. 근거 확인에 실패한 것이면 빈 목록 */
    public record ReviewView(int itemNo, String kind, Target target, String reason, List<String> blockedRules) {
    }

    public record SummaryResponse(Long analysisId, SummaryStatus summaryStatus, String summaryMessage,
            TextStatus textStatus, List<ItemView> items, int reviewNeededCount, List<ReviewView> reviewNeeded) {
    }
}
