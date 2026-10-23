package com.dartinsight.comparison;

import com.dartinsight.financial.domain.StatementType;
import com.dartinsight.report.domain.ReportType;
import java.util.List;

/**
 * 재무제표 종류별 비교 규칙(잠정안, 결정 로그 '비교 가능성 규칙').
 * <ul>
 *   <li>재무상태표: 기말 시점 금액이라 언제나 비교한다.</li>
 *   <li>손익·포괄손익: 같은 종류의 보고서면 누적 금액을, 종류가 달라도 둘 다 분·반기보고서면 3개월 금액을
 *       비교한다. 사업보고서에는 4분기 3개월 금액이 없어 분·반기보고서와 비교하지 않는다.</li>
 *   <li>현금흐름·자본변동: 누적 금액만 있어 같은 종류의 보고서끼리만 비교한다.</li>
 * </ul>
 */
public final class StatementRules {

    private StatementRules() {
    }

    /**
     * @param note 비교하지 않을 때 그 이유
     */
    public record StatementRule(StatementType type, boolean comparable, AmountBasis amountBasis, String note) {

        static StatementRule of(StatementType type, AmountBasis basis) {
            return new StatementRule(type, true, basis, null);
        }

        static StatementRule not(StatementType type, String note) {
            return new StatementRule(type, false, null, note);
        }
    }

    public static List<StatementRule> rules(ReportType previous, ReportType current) {
        boolean sameType = previous == current;
        boolean bothInterim = previous != ReportType.ANNUAL && current != ReportType.ANNUAL;
        return List.of(
                StatementRule.of(StatementType.BS, AmountBasis.POINT),
                income(StatementType.IS, sameType, bothInterim),
                income(StatementType.CIS, sameType, bothInterim),
                cumulativeOnly(StatementType.CF, sameType),
                cumulativeOnly(StatementType.SCE, sameType));
    }

    private static StatementRule income(StatementType type, boolean sameType, boolean bothInterim) {
        if (sameType) {
            return StatementRule.of(type, AmountBasis.CUMULATIVE);
        }
        if (bothInterim) {
            return StatementRule.of(type, AmountBasis.QUARTER);
        }
        return StatementRule.not(type, "사업보고서에는 4분기 3개월 금액이 없어 분·반기보고서와 비교하지 않아요.");
    }

    private static StatementRule cumulativeOnly(StatementType type, boolean sameType) {
        return sameType ? StatementRule.of(type, AmountBasis.CUMULATIVE)
                : StatementRule.not(type, "누적 금액만 있어 기간 길이가 다른 보고서와 비교하지 않아요.");
    }
}
