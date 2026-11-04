package com.dartinsight.analysis.dto;

import com.dartinsight.analysis.domain.RiskSections;
import com.dartinsight.analysis.domain.TextChange;
import com.dartinsight.analysis.domain.TextChangeListing;
import com.dartinsight.analysis.domain.TextChangeListing.RowDiff;
import com.dartinsight.analysis.domain.TextChangeRow;
import com.dartinsight.analysis.domain.TextPreview;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.math.BigDecimal;
import java.util.List;

/**
 * previewText는 앞부분만(수정이면 처음 달라지는 곳부터). 전체 글은 상세(3.4)에서 본다.
 * riskRelated는 위험 관련 목차의 변경인지({@link RiskSections}, 3.9).
 * listGroup·field·raisedFromNote·noteScope·rowDiff는 목록 분류와 표 행 비교(ADR-0047)이고, 분류 전에 만든 분석이면 null이다.
 */
public record TextChangeItemResponse(long changeId, int changeNo, String changeType, String blockType,
        boolean numbersOnly, String sectionStatus, String sectionTitle, String sectionPath,
        String previousSectionPath, String previousPreview, String currentPreview, BigDecimal similarity, String reviewReason,
        PriorityView priority, boolean riskRelated, String listGroup, String field, Boolean raisedFromNote,
        String noteScope, RowDiffView rowDiff) {

    /** 목록에서 보여 줄 바뀐 행 수 */
    private static final int LIST_CHANGED_ROWS = 3;

    /** 목록 항목. 바뀐 행은 앞에서 {@value #LIST_CHANGED_ROWS}개까지만 준다 */
    public static TextChangeItemResponse from(TextChange change) {
        TextChangeListing listing = change.row().listing();
        return of(change, listing == null || listing.rowDiff() == null ? null : RowDiffView.inList(listing.rowDiff()));
    }

    /** 근거 상세의 항목. 바뀐 행 전부와 새 행·없는 행을 준다 */
    public static TextChangeItemResponse detail(TextChange change) {
        TextChangeListing listing = change.row().listing();
        return of(change, listing == null || listing.rowDiff() == null ? null : RowDiffView.whole(listing.rowDiff()));
    }

    private static TextChangeItemResponse of(TextChange change, RowDiffView rowDiff) {
        TextChangeRow row = change.row();
        TextChangeListing listing = row.listing();
        String previous = row.previous() == null ? null : row.previous().text();
        String current = row.current() == null ? null : row.current().text();
        int from = TextPreview.firstDifference(previous, current);
        return new TextChangeItemResponse(change.id(), change.changeNo(), row.changeType(), row.blockType(),
                row.numbersOnly(), row.sectionStatus(), row.sectionTitle(), row.sectionPath(),
                row.previousSectionPath(), TextPreview.cut(previous, from), TextPreview.cut(current, from), row.similarity(),
                row.reviewReason(), row.priority() == null ? null : new PriorityView(row.priority().level(),
                        row.priority().score(), row.priority().reasons()),
                RiskSections.isRiskRelated(row.sectionPath(), row.previousSectionPath()),
                listing == null ? null : listing.group(), listing == null ? null : listing.field(),
                listing == null ? null : listing.raisedFromNote(), listing == null ? null : listing.noteScope(),
                rowDiff);
    }

    /** 확인 우선순위. level은 HIGH, MEDIUM, LOW, UNRANKED(판단 유보), reasons는 적용한 규칙 */
    public record PriorityView(String level, Integer score, List<String> reasons) {
    }

    /** 표 행 비교. addedKeys·missingKeys는 근거 상세에만 있다 */
    public record RowDiffView(String status, String keyColumn, RowDiff.Counts counts,
            RowDiff.PairedPrevious pairedPrevious, List<RowDiff.ChangedRow> changedRows,
            @JsonInclude(JsonInclude.Include.NON_NULL) List<String> addedKeys,
            @JsonInclude(JsonInclude.Include.NON_NULL) List<String> missingKeys) {

        static RowDiffView inList(RowDiff diff) {
            return new RowDiffView(diff.status(), diff.keyColumn(), diff.counts(), diff.pairedPrevious(),
                    diff.changedRows().stream().limit(LIST_CHANGED_ROWS).toList(), null, null);
        }

        static RowDiffView whole(RowDiff diff) {
            return new RowDiffView(diff.status(), diff.keyColumn(), diff.counts(), diff.pairedPrevious(),
                    diff.changedRows(), diff.addedKeys(), diff.missingKeys());
        }
    }
}
