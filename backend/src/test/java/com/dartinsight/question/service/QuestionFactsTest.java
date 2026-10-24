package com.dartinsight.question.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.dartinsight.analysis.domain.CalcStatus;
import com.dartinsight.analysis.domain.FinancialChange;
import com.dartinsight.analysis.domain.FinancialChangeRow;
import com.dartinsight.analysis.domain.FinancialChangeRow.Evidence;
import com.dartinsight.comparison.domain.AmountBasis;
import com.dartinsight.financial.domain.FsDiv;
import com.dartinsight.question.domain.QuestionFact;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class QuestionFactsTest {

    private static FinancialChange change(String accountId, String name, int order, long previous, long current) {
        Evidence prev = new Evidence("20250814000001", "BS", accountId, name, null);
        Evidence cur = new Evidence("20260814000001", "BS", accountId, name, null);
        return FinancialChange.of(1L, new FinancialChangeRow("BS", FsDiv.CFS, accountId, name, order, AmountBasis.POINT,
                previous, current, current - previous, null, CalcStatus.OK, "KRW", prev, cur));
    }

    @Test
    @DisplayName("질문 낱말이 계정 이름 안에 있으면 그 계정을 사실로 고르고, 이름이 그대로 나온 계정을 먼저 둔다")
    void questionTermsInsideAccountNamesAreMatchedAfterExactNames() {
        List<FinancialChange> changes = List.of(
                change("a", "단기차입금", 1, 7L, 13L),
                change("b", "장기차입금", 2, 3L, 4L),
                change("c", "자산총계", 3, 100L, 150L));

        List<QuestionFact> facts = QuestionFacts.match("차입금이 늘어난 이유는?", changes);

        assertThat(facts).extracting(QuestionFact::accountName).containsExactly("단기차입금", "장기차입금");
        assertThat(QuestionFacts.match("장기차입금과 차입금", changes)).extracting(QuestionFact::accountName)
                .startsWith("장기차입금");
    }
}
