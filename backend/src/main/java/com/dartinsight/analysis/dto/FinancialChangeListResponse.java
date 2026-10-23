package com.dartinsight.analysis.dto;

import com.dartinsight.analysis.domain.CalcStatus;
import com.dartinsight.analysis.domain.FinancialChange;
import com.dartinsight.comparison.domain.AmountBasis;
import com.dartinsight.comparison.service.StatementRules.StatementRule;
import com.dartinsight.financial.domain.FsDiv;
import java.math.BigDecimal;
import java.util.List;

public record FinancialChangeListResponse(Long analysisId, FsDiv fsDiv, String sjDiv, boolean changedOnly,
        List<StatementSummary> statements, List<FinancialChangeItem> items) {

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
            AmountBasis amountBasis,
            Long previousAmount,
            Long currentAmount,
            Long changeAmount,
            BigDecimal changeRate,
            String direction,
            CalcStatus calcStatus,
            String calcMessage,
            String currency) {

        public static FinancialChangeItem from(FinancialChange c) {
            return new FinancialChangeItem(c.getId(), c.getSjDiv(), c.getAccountName(), c.getAmountBasis(),
                    c.getPreviousAmount(), c.getCurrentAmount(), c.getChangeAmount(), c.getChangeRate(),
                    c.direction(), c.getCalcStatus(), c.getCalcStatus().message(), c.getCurrency());
        }
    }
}
