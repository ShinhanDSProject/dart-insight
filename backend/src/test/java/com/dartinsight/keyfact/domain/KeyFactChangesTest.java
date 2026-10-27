package com.dartinsight.keyfact.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

import com.dartinsight.keyfact.domain.KeyFactChange.Type;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class KeyFactChangesTest {

    @Test
    @DisplayName("최대주주는 추가·지분율 변경을 현재 순서로, 빠진 주주를 그 뒤에 둔다")
    void majorShareholderChangesInOrder() {
        List<MajorShareholder> previous = List.of(holder("가", "10.0"), holder("나", "5.0"));
        List<MajorShareholder> current = List.of(holder("다", "1.0"), holder("가", "11.0"));

        assertThat(KeyFactChanges.majorShareholders(previous, current))
                .extracting(KeyFactChange::type, KeyFactChange::name, KeyFactChange::before, KeyFactChange::after)
                .containsExactly(
                        tuple(Type.ADDED, "다", null, "1.0"),
                        tuple(Type.CHANGED, "가", "10.0", "11.0"),
                        tuple(Type.REMOVED, "나", "5.0", null));
    }

    @Test
    @DisplayName("배당은 주당 현금배당금 행의 당기 값이 다를 때만 바뀐 항목이다")
    void dividendChangesOnlyCashPerShare() {
        List<Dividend> previous = List.of(new Dividend("주당 현금배당금(원)", "보통주", "100", null, null),
                new Dividend("현금배당성향(%)", null, "20", null, null));
        List<Dividend> current = List.of(new Dividend("주당 현금배당금(원)", "보통주", "150", null, null),
                new Dividend("현금배당성향(%)", null, "25", null, null));

        assertThat(KeyFactChanges.dividends(previous, current)).singleElement()
                .extracting(KeyFactChange::field, KeyFactChange::before, KeyFactChange::after)
                .containsExactly("currentTerm", "100", "150");
    }

    private static MajorShareholder holder(String name, String endRatio) {
        return new MajorShareholder(name, null, "보통주", null, null, "1", endRatio, null);
    }
}
