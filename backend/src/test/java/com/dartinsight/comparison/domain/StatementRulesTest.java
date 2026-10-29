package com.dartinsight.comparison.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.dartinsight.comparison.domain.StatementRules.StatementRule;
import com.dartinsight.report.domain.ReportType;
import java.util.List;
import com.dartinsight.financial.domain.StatementType;
import org.junit.jupiter.api.DisplayName;
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

    @Test
    @DisplayName("보고서 쌍을 비교할 수 없으면 다섯 재무제표 모두 비교 안 함과 이유를 갖는다")
    void notComparablePairComparesNoStatement() {
        assertThat(StatementRules.notComparablePair()).extracting(StatementRule::type)
                .containsExactly(StatementType.values());
        assertThat(StatementRules.notComparablePair()).allSatisfy(rule -> {
            assertThat(rule.comparable()).isFalse();
            assertThat(rule.amountBasis()).isNull();
            assertThat(rule.note()).isEqualTo("비교할 수 없는 보고서 쌍이라 재무제표를 비교하지 않아요.");
        });
    }
}
