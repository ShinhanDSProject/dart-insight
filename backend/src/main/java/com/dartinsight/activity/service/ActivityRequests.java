package com.dartinsight.activity.service;

import com.dartinsight.activity.domain.ActivityPayload.Evidence;
import com.dartinsight.activity.domain.FinancialFactText;
import com.dartinsight.activity.domain.PeriodDisclosure;
import com.dartinsight.activity.dto.ActivityAiRequest;
import com.dartinsight.analysis.domain.FinancialChange;
import com.dartinsight.analysis.domain.FinancialChangeRow;
import com.dartinsight.analysis.domain.TextChange;
import com.dartinsight.analysis.domain.TextChangeListing;
import com.dartinsight.analysis.domain.TextChangeRow;
import com.dartinsight.analysis.domain.TextChangeRow.Side;
import com.dartinsight.report.domain.Report;
import com.dartinsight.summary.service.SummarySelector;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 두 보고서 사이 활동 요청 만들기(ADR-0067). 후보를 고르는 규칙은 ai-server에 있고(ADR-0051과 같음), 여기서는 후보가 될 수 있는
 * 묶음만 보낸다. 분류하지 않은 옛 분석의 변경은 MAIN으로 보낸다.
 */
final class ActivityRequests {

    static final String PREVIOUS = "PREVIOUS";
    static final String CURRENT = "CURRENT";
    static final String FINANCIAL = "FINANCIAL";
    static final String DISCLOSURE = "DISCLOSURE";
    /** ai-server가 후보를 고르는 묶음 */
    private static final Set<String> SENT_GROUPS = Set.of(TextChangeListing.MAIN, "UNPAIRED", "HEADING");
    /** ai-server app/activity/model.py TEXT_LIMIT와 같다. 요청 크기를 줄이려고 여기서도 자른다 */
    static final int TEXT_LIMIT = 500;
    /** ai-server app/activity/schema.py MAX_CHANGES와 같다 */
    static final int MAX_CHANGES = 5000;

    private ActivityRequests() {
    }

    /** 보낼 변경. 분류된 변경은 후보가 될 수 있는 묶음만, 분류하지 않은 변경은 모두. 문서 순서로 최대 5,000건 */
    static List<TextChange> sent(List<TextChange> changes) {
        return changes.stream().filter(change -> {
            TextChangeListing listing = change.row().listing();
            return listing == null || SENT_GROUPS.contains(listing.group());
        }).limit(MAX_CHANGES).toList();
    }

    /** 요약에 넣을 재무 수치: 결과 요약과 같은 기준으로 코드가 고른 계정(SummarySelector) */
    static List<FinancialChange> financials(List<FinancialChange> changes) {
        List<FinancialChangeRow> rows = changes.stream().map(ActivityRequests::row).toList();
        return SummarySelector.financial(rows).stream().map(changes::get).toList();
    }

    static ActivityAiRequest of(String promptVersion, String companyName, Report previous, Report current,
            List<TextChange> sent, List<FinancialChange> financials, List<ActivityAiRequest.Disclosure> disclosures) {
        return new ActivityAiRequest(promptVersion, companyName, previous.getReportName(), current.getReportName(),
                previous.getPeriodEnd().toString(), current.getRceptDt().toString(),
                financials.stream().map(f -> new ActivityAiRequest.Financial(financialId(f),
                        FinancialFactText.text(f))).toList(),
                disclosures, sent.stream().map(ActivityRequests::change).toList());
    }

    /** 근거 ID → 원문 위치. AI가 댄 근거가 보낸 원문인지 backend도 다시 확인하는 데 쓴다 */
    static Map<String, Evidence> evidence(List<TextChange> sent, List<FinancialChange> financials,
            List<PeriodDisclosure> disclosures) {
        Map<String, Evidence> byId = new HashMap<>();
        for (FinancialChange change : financials) {
            byId.put(financialId(change), new Evidence(financialId(change), change.getCurrentRceptNo(), null, FINANCIAL,
                    FinancialFactText.label(change), null));
        }
        for (PeriodDisclosure disclosure : disclosures) {
            byId.put(disclosure.evidenceId(), new Evidence(disclosure.evidenceId(), disclosure.rceptNo(), null,
                    DISCLOSURE, disclosure.reportName(), null));
        }
        for (TextChange change : sent) {
            TextChangeRow row = change.row();
            String path = row.sectionPath() == null ? "" : row.sectionPath();
            put(byId, change, row.previous(), PREVIOUS, path);
            put(byId, change, row.current(), CURRENT, path);
        }
        return byId;
    }

    private static String financialId(FinancialChange change) {
        return "F" + change.getId();
    }

    private static FinancialChangeRow row(FinancialChange c) {
        return new FinancialChangeRow(c.getSjDiv(), c.getFsDiv(), c.getAccountKey(), c.getAccountName(),
                c.getDisplayOrder(), c.getAmountBasis(), c.getPreviousAmount(), c.getCurrentAmount(),
                c.getChangeAmount(), c.getChangeRate(), c.getCalcStatus(), c.getCurrency(), null, null);
    }

    /** 원문 위치 `{접수번호}#B{블록 번호}`. 블록 번호가 없으면 null */
    static String evidenceId(Side side) {
        return side == null || side.blockNo() == null ? null : side.rceptNo() + "#B" + side.blockNo();
    }

    private static void put(Map<String, Evidence> byId, TextChange change, Side side, String role, String path) {
        String id = evidenceId(side);
        if (id != null && side.text() != null && !side.text().isBlank()) {
            byId.putIfAbsent(id, new Evidence(id, side.rceptNo(), side.blockNo(), role, path, change.id()));
        }
    }

    private static ActivityAiRequest.Change change(TextChange change) {
        TextChangeRow row = change.row();
        TextChangeListing listing = row.listing();
        Side previous = row.previous();
        Side current = row.current();
        return new ActivityAiRequest.Change(change.changeNo(), row.changeType(), row.blockType(),
                listing == null ? TextChangeListing.MAIN : listing.group(), listing == null ? null : listing.field(),
                listing != null && listing.raisedFromNote(), row.sectionPath() == null ? "" : row.sectionPath(),
                evidenceId(previous), evidenceId(current), text(previous), text(current));
    }

    private static String text(Side side) {
        if (side == null || side.text() == null) {
            return null;
        }
        String text = side.text();
        return text.length() <= TEXT_LIMIT ? text : text.substring(0, TEXT_LIMIT);
    }
}
