package com.dartinsight.analysis;

import com.dartinsight.analysis.TextChangeQueryService.TextChangePage;
import com.dartinsight.analysis.TextChangeStore.TextChange;
import com.dartinsight.analysis.TextEvidenceService.SourceEvidence;
import com.dartinsight.analysis.TextEvidenceService.TextEvidence;
import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.web.ApiPaths;
import com.dartinsight.document.DocumentBlock;
import com.dartinsight.report.ReportType;
import com.fasterxml.jackson.annotation.JsonRawValue;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 문장·표 변경 목록(2.5). 화면 W-03 ③. 완료된 분석의 그 분석 결과만 돌려준다.
 * 기본 정렬은 확인 우선순위(2.6)이고, 순위를 매기지 않은 항목(판단 유보)은 뒤에 둔다.
 */
@RestController
@RequestMapping(ApiPaths.ANALYSIS_TEXT_CHANGES)
public class TextChangeController {

    private static final Set<String> TYPES = Set.of(TextChangeRow.ADDED, TextChangeRow.DELETED,
            TextChangeRow.MODIFIED, TextChangeRow.REVIEW_NEEDED);
    private static final int MAX_SIZE = 100;

    private final TextChangeQueryService queryService;
    private final TextEvidenceService evidenceService;

    public TextChangeController(TextChangeQueryService queryService, TextEvidenceService evidenceService) {
        this.queryService = queryService;
        this.evidenceService = evidenceService;
    }

    /** 문장·표 근거 상세(3.4). 변경 전·후 원문 전체와 보고서·항목·위치 */
    @GetMapping(ApiPaths.BY_CHANGE_ID)
    public TextChangeDetailResponse detail(@PathVariable Long analysisId, @PathVariable Long changeId) {
        TextEvidence evidence = evidenceService.evidence(analysisId, changeId);
        return new TextChangeDetailResponse(item(evidence.change()), source(evidence.previous()),
                source(evidence.current()));
    }

    private static SourceView source(SourceEvidence evidence) {
        if (evidence == null) {
            return null;
        }
        TextChangeRow.Side side = evidence.side();
        return new SourceView(side.rceptNo(), evidence.report().getReportName(), evidence.report().getReportType(),
                evidence.report().getFiscalYear(), evidence.report().getPeriodEnd(), side.sectionNo(),
                evidence.sectionPath(), side.blockNo(),
                side.blockNo() == null ? null : DocumentBlock.evidenceId(side.rceptNo(), side.blockNo()),
                evidence.blockType(), side.text(), evidence.tableJson(), evidence.blockMatches(), evidence.dartUrl());
    }

    @GetMapping
    public TextChangeListResponse list(@PathVariable Long analysisId,
            @RequestParam(required = false) String type,
            @RequestParam(defaultValue = "priority") String sort,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        if (!"priority".equals(sort) && !"document".equals(sort)) {
            throw ApiException.invalidInput("sort", "priority 또는 document여야 합니다.");
        }
        if (type != null && !TYPES.contains(type)) {
            throw ApiException.invalidInput("type", "ADDED, DELETED, MODIFIED, REVIEW_NEEDED 중 하나여야 합니다.");
        }
        if (page < 0) {
            throw ApiException.invalidInput("page", "0 이상이어야 합니다.");
        }
        if (size < 1 || size > MAX_SIZE) {
            throw ApiException.invalidInput("size", "1에서 " + MAX_SIZE + " 사이여야 합니다.");
        }
        long offset = (long) page * size; // 큰 page에서 int가 넘쳐 음수가 되지 않게
        TextChangePage result = queryService.page(analysisId, type, "priority".equals(sort), offset, size);
        Analysis analysis = result.analysis();
        Map<String, Integer> counts = result.counts();
        int all = counts.values().stream().mapToInt(Integer::intValue).sum();
        Counts countView = new Counts(all, counts.get(TextChangeRow.ADDED), counts.get(TextChangeRow.DELETED),
                counts.get(TextChangeRow.MODIFIED), counts.get(TextChangeRow.REVIEW_NEEDED));
        int total = type == null ? all : counts.get(type);
        List<TextChangeItem> items = result.changes().stream().map(TextChangeController::item).toList();
        return new TextChangeListResponse(analysisId, analysis.getTextStatus(), analysis.getTextMessage(), type,
                sort, page, size, total, countView, items);
    }

    static TextChangeItem item(TextChange change) {
        TextChangeRow row = change.row();
        String previous = row.previous() == null ? null : row.previous().text();
        String current = row.current() == null ? null : row.current().text();
        int from = TextPreview.firstDifference(previous, current);
        return new TextChangeItem(change.id(), change.changeNo(), row.changeType(), row.blockType(),
                row.numbersOnly(), row.sectionStatus(), row.sectionTitle(), row.sectionPath(),
                TextPreview.cut(previous, from), TextPreview.cut(current, from), row.similarity(),
                row.reviewReason(), row.priority() == null ? null : new PriorityView(row.priority().level(),
                        row.priority().score(), row.priority().reasons()));
    }

    public record Counts(int all, int added, int deleted, int modified, int reviewNeeded) {
    }

    /** previewText는 앞부분만(수정이면 처음 달라지는 곳부터). 전체 글은 상세(3.4)에서 본다. */
    public record TextChangeItem(long changeId, int changeNo, String changeType, String blockType,
            boolean numbersOnly, String sectionStatus, String sectionTitle, String sectionPath,
            String previousPreview, String currentPreview, BigDecimal similarity, String reviewReason,
            PriorityView priority) {
    }

    /** 확인 우선순위. level은 HIGH, MEDIUM, LOW, UNRANKED(판단 유보), reasons는 적용한 규칙 */
    public record PriorityView(String level, Integer score, List<String> reasons) {
    }

    /** 한쪽 보고서의 원문 근거. text는 전체 글, table은 표 셀(문단이면 null) */
    public record SourceView(String rceptNo, String reportName, ReportType reportType, int fiscalYear,
            LocalDate periodEnd, int sectionNo, String sectionPath, Integer blockNo, String evidenceId,
            String blockType, String text, @JsonRawValue String table, boolean blockMatches, String dartUrl) {
    }

    /** 목록 항목에 두 보고서의 근거를 더한다. 없는 쪽은 null */
    public record TextChangeDetailResponse(TextChangeItem change, SourceView previous, SourceView current) {
    }

    public record TextChangeListResponse(Long analysisId, TextStatus textStatus, String textMessage, String type,
            String sort, int page, int size, int totalItems, Counts counts, List<TextChangeItem> items) {
    }
}
