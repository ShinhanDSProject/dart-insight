package com.dartinsight.analysis.dto;

import com.dartinsight.analysis.domain.CalcStatus;
import com.dartinsight.analysis.domain.ChangeScale;
import com.dartinsight.analysis.domain.ChangeScale.Base;
import com.dartinsight.analysis.domain.ChangeScale.Reason;
import com.dartinsight.analysis.domain.FinancialChange;
import com.dartinsight.analysis.service.FinancialChangeQueryService.FinancialChanges;
import com.dartinsight.comparison.domain.AmountBasis;
import com.dartinsight.comparison.domain.StatementRules.StatementRule;
import com.dartinsight.financial.domain.FsDiv;
import com.dartinsight.financial.domain.StatementType;
import java.math.BigDecimal;
import java.util.List;

public record FinancialChangeListResponse(Long analysisId, FsDiv fsDiv, String sjDiv, boolean changedOnly,
        String sort, List<StatementSummary> statements, List<FinancialChangeItem> items) {

    /** 원문 계정 순서(기본) */
    public static final String SORT_DOCUMENT = "document";

    /** 규모 큰 순: 크기 맥락 비율의 절댓값이 큰 것부터(#480) */
    public static final String SORT_SCALE = "scale";

    /**
     * 재무제표 요약은 전부, 계정 목록은 고른 재무제표의 것만(changedOnly면 값이 바뀌었거나 계산하지 못한 계정만).
     * sort가 scale이면 거른 뒤 규모 큰 순으로 둔다.
     */
    public static FinancialChangeListResponse of(Long analysisId, StatementType selected, boolean changedOnly,
            String sort, FinancialChanges result) {
        List<StatementSummary> statements = result.rules().stream()
                .map(rule -> StatementSummary.of(rule, result.changes())).toList();
        List<FinancialChange> rows = result.changes().stream()
                .filter(c -> c.getSjDiv().equals(selected.name()))
                .filter(c -> !changedOnly || c.changedOrUncalculated())
                .toList();
        List<FinancialChange> ordered = SORT_SCALE.equals(sort) ? result.scales().sortByScale(rows) : rows;
        List<FinancialChangeItem> items = ordered.stream()
                .map(c -> FinancialChangeItem.from(c, result.scales().scaleOf(c)))
                .toList();
        return new FinancialChangeListResponse(analysisId, result.analysis().getFsDiv(), selected.name(), changedOnly,
                sort, statements, items);
    }

    /**
     * @param total   계정 수
     * @param changed 값이 바뀌었거나 계산하지 못한 계정 수
     */
    public record StatementSummary(String sjDiv, String label, boolean comparable, AmountBasis amountBasis,
            String note, int total, int changed) {

        /** @param changes 분석의 모든 계정 변화. 이 재무제표의 것만 센다 */
        public static StatementSummary of(StatementRule rule, List<FinancialChange> changes) {
            List<FinancialChange> rows = changes.stream()
                    .filter(c -> c.getSjDiv().equals(rule.type().name())).toList();
            return new StatementSummary(rule.type().name(), rule.type().label(), rule.comparable(),
                    rule.amountBasis(), rule.note(), rows.size(),
                    (int) rows.stream().filter(FinancialChange::changedOrUncalculated).count());
        }
    }

    public record FinancialChangeItem(
            Long changeId,
            String sjDiv,
            String accountName,
            String accountDetail,
            AmountBasis amountBasis,
            Long previousAmount,
            Long currentAmount,
            Long changeAmount,
            BigDecimal changeRate,
            String direction,
            CalcStatus calcStatus,
            String calcMessage,
            String currency,
            Scale scale) {

        public static FinancialChangeItem from(FinancialChange c, ChangeScale scale) {
            return new FinancialChangeItem(c.getId(), c.getSjDiv(), c.getAccountName(), c.getAccountDetail(),
                    c.getAmountBasis(),
                    c.getPreviousAmount(), c.getCurrentAmount(), c.getChangeAmount(), c.getChangeRate(),
                    c.direction(), c.getCalcStatus(), c.getCalcStatus().message(), c.getCurrency(),
                    Scale.from(scale));
        }
    }

    /**
     * 증감액의 크기 맥락(#480, docs/api-spec.md '크기 맥락').
     *
     * @param ratio  증감액 ÷ 기준 값(소수 6자리). 계산하지 않으면 null
     * @param reason ratio가 null인 사유. 계산했으면 null
     */
    public record Scale(Base base, String baseAccountName, Long baseAmount, BigDecimal ratio, Reason reason) {

        public static Scale from(ChangeScale scale) {
            return new Scale(scale.base(), scale.baseAccountName(), scale.baseAmount(), scale.ratio(),
                    scale.reason());
        }
    }
}
