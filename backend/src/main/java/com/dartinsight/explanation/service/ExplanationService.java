package com.dartinsight.explanation.service;

import com.dartinsight.aiserver.client.AiServerException;
import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.domain.TextChange;
import com.dartinsight.analysis.domain.TextChangeRow.Side;
import com.dartinsight.analysis.service.TextChangeQueryService;
import com.dartinsight.analysis.service.TextChangeQueryService.CompletedTextChange;
import com.dartinsight.analysis.service.TextEvidenceService;
import com.dartinsight.common.trace.TraceContext;
import com.dartinsight.document.domain.DocumentBlock;
import com.dartinsight.document.service.DocumentService;
import com.dartinsight.explanation.domain.ExplanationStatus;
import com.dartinsight.explanation.domain.TextExplanationRecord;
import com.dartinsight.explanation.dto.TextExplanationResponse;
import com.dartinsight.explanation.dto.TextExplanationResponse.Location;
import com.dartinsight.explanation.repository.ExplanationStore;
import com.dartinsight.report.service.ReportService;
import com.dartinsight.report.service.ReportService.ReportDetail;
import com.dartinsight.summary.domain.LlmCallRow;
import com.dartinsight.summary.domain.SummaryItemRow;
import com.dartinsight.summary.service.SummaryQueryService;
import com.dartinsight.summary.service.SummaryService;
import com.dartinsight.summary.service.SummaryService.TextExplanation;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 문장 변경 AI 한 줄 풀이(3.11, FS-6). 순서: 저장된 풀이 → 요약(summary_item)의 그 변경 문장 → 원문이 없으면 AI 없이
 * NO_SOURCE → 요약과 같은 /internal/summaries를 문장 항목 하나로 불러 만든다(근거 확인은 SummaryService와 같음).
 * AI 서버 호출은 트랜잭션 밖에서 하고, 풀이와 LLM 호출 기록만 한 트랜잭션으로 저장한다(LY-2). 다시 만들지 않는다.
 */
@Service
@RequiredArgsConstructor
public class ExplanationService {

    static final String NO_SOURCE = "두 보고서에서 이 변경의 원문을 짝짓지 못해 풀이할 수 없어요.";
    private static final String NO_REASON = "근거를 확인하지 못했어요.";

    private static final Logger log = LoggerFactory.getLogger(ExplanationService.class);

    private final TextChangeQueryService textChangeQueryService;
    private final SummaryQueryService summaryQueryService;
    private final SummaryService summaryService;
    private final ReportService reportService;
    private final DocumentService documentService;
    private final ExplanationStore explanationStore;
    private final TransactionTemplate transactionTemplate;
    private final Clock clock;

    /** 저장한 시각이 [from, to)인 풀이의 상태별 수(AI 사용 현황). 모든 분석의 풀이를 센다 */
    public Map<ExplanationStatus, Long> usage(LocalDateTime from, LocalDateTime to) {
        return explanationStore.countByStatus(from, to);
    }

    /**
     * 그 변경의 한 줄 풀이를 만들거나 저장된 것을 돌려준다. 완료된 분석에만(아니면 409), 이 분석의 변경만(아니면 404).
     *
     * @throws AiServerException AI 서버·LLM을 쓸 수 없음(503 AI_SERVER_UNAVAILABLE, 저장하지 않음)
     */
    public TextExplanationResponse explain(Long analysisId, Long changeId) {
        CompletedTextChange completed = textChangeQueryService.completedChange(analysisId, changeId);
        Analysis analysis = completed.analysis();
        TextChange change = completed.change();

        Optional<TextExplanationRecord> stored = explanationStore.find(analysisId, change.changeNo());
        if (stored.isPresent()) {
            return response(analysis, change, stored.get(), true);
        }

        String traceId = TraceContext.currentTraceId();
        Optional<SummaryItemRow> summarized = summaryQueryService.shownText(analysisId, change.changeNo());
        if (summarized.isPresent()) {
            SummaryItemRow row = summarized.get();
            return save(analysis, change, new TextExplanationRecord(null, analysisId, change.changeNo(),
                    ExplanationStatus.OK, row.aiText(), row.evidenceIds(), null, List.of(), row.model(),
                    row.promptVersion(), row.generatedAt(), traceId, now()), List.of());
        }

        if (!SummaryService.explainable(change.row())) {
            return save(analysis, change, new TextExplanationRecord(null, analysisId, change.changeNo(),
                    ExplanationStatus.NO_SOURCE, null, List.of(), NO_SOURCE, List.of(), null, null, null, traceId,
                    now()), List.of());
        }

        ReportDetail current = reportService.get(analysis.getCurrentRceptNo());
        ReportDetail previous = reportService.get(analysis.getPreviousRceptNo());
        TextExplanation explained = summaryService.explain(current.company().getCorpName(),
                previous.report().getReportName(), current.report().getReportName(), change.row(),
                change.changeNo());
        SummaryItemRow row = explained.row();
        TextExplanationRecord record = SummaryItemRow.SHOWN.equals(row.status())
                ? new TextExplanationRecord(null, analysisId, change.changeNo(), ExplanationStatus.OK, row.aiText(),
                        row.evidenceIds(), null, List.of(), row.model(), row.promptVersion(), row.generatedAt(),
                        traceId, now())
                : new TextExplanationRecord(null, analysisId, change.changeNo(), ExplanationStatus.REVIEW_NEEDED,
                        null, List.of(), row.reviewReason() == null ? NO_REASON : row.reviewReason(),
                        row.blockedRules(), null, null, null, traceId, now());
        return save(analysis, change, record, explained.calls());
    }

    private TextExplanationResponse save(Analysis analysis, TextChange change, TextExplanationRecord row,
            List<LlmCallRow> calls) {
        try {
            Long id = transactionTemplate.execute(status -> explanationStore.save(row, calls));
            return response(analysis, change, row.withId(id), false);
        } catch (DuplicateKeyException e) {
            // 같은 변경을 동시에 요청해 다른 요청이 먼저 저장했다. 다시 만들지 않고 저장된 것을 돌려준다
            log.info("같은 변경의 풀이가 먼저 저장돼 저장된 것을 돌려줍니다: analysis={}, change={}",
                    row.analysisId(), row.changeNo());
            TextExplanationRecord stored = explanationStore.find(row.analysisId(), row.changeNo())
                    .orElseThrow(() -> new IllegalStateException("저장된 풀이를 찾지 못했습니다", e));
            return response(analysis, change, stored, true);
        }
    }

    private TextExplanationResponse response(Analysis analysis, TextChange change, TextExplanationRecord row,
            boolean cached) {
        Map<String, Location> located = row.status() == ExplanationStatus.OK ? locations(change) : Map.of();
        return TextExplanationResponse.of(change.id(), row, located, analysis.getCurrentRceptNo(),
                analysis.getPreviousRceptNo(), cached);
    }

    /**
     * 그 변경의 두 쪽 원문 위치. 풀이의 근거는 이 변경에 보낸 원문으로만 받으므로(요약도 같음) 이 둘 안에 있다.
     * 섹션 번호는 분석 때 저장한 위치이고, 경로는 그 보고서의 구조화된 원문에서 읽는다(쓸 수 없으면 변경의 섹션 경로).
     */
    private Map<String, Location> locations(TextChange change) {
        Map<String, Location> located = new HashMap<>();
        for (Side side : new Side[] {change.row().previous(), change.row().current()}) {
            if (side == null || side.blockNo() == null) {
                continue;
            }
            String path = documentService.find(side.rceptNo()).filter(d -> d.getStatus().usable())
                    .map(d -> TextEvidenceService.paths(documentService.sections(d)).get(side.sectionNo()))
                    .orElse(null);
            located.put(DocumentBlock.evidenceId(side.rceptNo(), side.blockNo()),
                    new Location(side.sectionNo(), path == null ? change.row().sectionPath() : path));
        }
        return located;
    }

    private LocalDateTime now() {
        return LocalDateTime.now(clock).truncatedTo(ChronoUnit.MICROS);
    }
}
