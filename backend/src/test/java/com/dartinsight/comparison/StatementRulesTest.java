package com.dartinsight.comparison;

import static org.assertj.core.api.Assertions.assertThat;

import com.dartinsight.comparison.StatementRules.StatementRule;
import com.dartinsight.report.ReportType;
import java.util.List;
import org.junit.jupiter.api.Test;

class StatementRulesTest {

    private static List<AmountBasis> bases(ReportType previous, ReportType current) {
        return StatementRules.rules(previous, current).stream().map(StatementRule::amountBasis).toList();
    }

    @Test
    void sameKindComparesEverythingCumulatively() {
        // BS, IS, CIS, CF, SCE 순서
        assertThat(bases(ReportType.HALF, ReportType.HALF)).containsExactly(AmountBasis.POINT,
                AmountBasis.CUMULATIVE, AmountBasis.CUMULATIVE, AmountBasis.CUMULATIVE, AmountBasis.CUMULATIVE);
        assertThat(bases(ReportType.ANNUAL, ReportType.ANNUAL)).doesNotContainNull();
    }

    @Test
    void differentInterimReportsCompareQuarterIncome() {
        assertThat(bases(ReportType.Q1, ReportType.HALF)).containsExactly(AmountBasis.POINT, AmountBasis.QUARTER,
                AmountBasis.QUARTER, null, null);
        assertThat(bases(ReportType.HALF, ReportType.Q3)).containsExactly(AmountBasis.POINT, AmountBasis.QUARTER,
                AmountBasis.QUARTER, null, null);
    }

    @Test
    void annualAgainstInterimComparesBalanceSheetOnly() {
        assertThat(bases(ReportType.Q3, ReportType.ANNUAL)).containsExactly(AmountBasis.POINT, null, null, null,
                null);
        assertThat(bases(ReportType.ANNUAL, ReportType.Q1)).containsExactly(AmountBasis.POINT, null, null, null,
                null);
        assertThat(StatementRules.rules(ReportType.ANNUAL, ReportType.Q1))
                .filteredOn(rule -> !rule.comparable())
                .allSatisfy(rule -> assertThat(rule.note()).isNotBlank());
    }
}
