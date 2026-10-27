package com.dartinsight.analysis.dto;

import com.dartinsight.analysis.domain.RiskSections;
import com.dartinsight.analysis.domain.TextChange;
import com.dartinsight.analysis.domain.TextChangeRow;
import com.dartinsight.analysis.domain.TextPreview;
import java.math.BigDecimal;
import java.util.List;

/**
 * previewText는 앞부분만(수정이면 처음 달라지는 곳부터). 전체 글은 상세(3.4)에서 본다.
 * riskRelated는 위험 관련 목차의 변경인지({@link RiskSections}, 3.9).
 */
public record TextChangeItemResponse(long changeId, int changeNo, String changeType, String blockType,
        boolean numbersOnly, String sectionStatus, String sectionTitle, String sectionPath,
        String previousSectionPath, String previousPreview, String currentPreview, BigDecimal similarity, String reviewReason,
        PriorityView priority, boolean riskRelated) {

    public static TextChangeItemResponse from(TextChange change) {
        TextChangeRow row = change.row();
        String previous = row.previous() == null ? null : row.previous().text();
        String current = row.current() == null ? null : row.current().text();
        int from = TextPreview.firstDifference(previous, current);
        return new TextChangeItemResponse(change.id(), change.changeNo(), row.changeType(), row.blockType(),
                row.numbersOnly(), row.sectionStatus(), row.sectionTitle(), row.sectionPath(),
                row.previousSectionPath(), TextPreview.cut(previous, from), TextPreview.cut(current, from), row.similarity(),
                row.reviewReason(), row.priority() == null ? null : new PriorityView(row.priority().level(),
                        row.priority().score(), row.priority().reasons()),
                RiskSections.isRiskRelated(row.sectionPath(), row.previousSectionPath()));
    }

    /** 확인 우선순위. level은 HIGH, MEDIUM, LOW, UNRANKED(판단 유보), reasons는 적용한 규칙 */
    public record PriorityView(String level, Integer score, List<String> reasons) {
    }
}
