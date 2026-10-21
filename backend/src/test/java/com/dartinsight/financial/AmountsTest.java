package com.dartinsight.financial;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class AmountsTest {

    @Test
    void parsesWholeWon() {
        assertThat(Amounts.parse("79604149000000")).isEqualTo(79_604_149_000_000L);
        assertThat(Amounts.parse("-1234")).isEqualTo(-1234L);
        assertThat(Amounts.parse("1,234,567")).isEqualTo(1_234_567L);
        assertThat(Amounts.parse("0")).isZero();
        assertThat(Amounts.parse("1000.00")).isEqualTo(1000L);
    }

    @Test
    void missingValueIsNullNotZero() {
        assertThat(Amounts.parse(null)).isNull();
        assertThat(Amounts.parse("")).isNull();
        assertThat(Amounts.parse("  ")).isNull();
        assertThat(Amounts.parse("-")).isNull();
    }

    @Test
    void unreadableValueIsNull() {
        assertThat(Amounts.parse("12.5")).isNull();
        assertThat(Amounts.parse("abc")).isNull();
    }
}
