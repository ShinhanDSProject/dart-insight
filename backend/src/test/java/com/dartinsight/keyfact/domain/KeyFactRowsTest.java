package com.dartinsight.keyfact.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.List;
import java.util.function.Function;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class KeyFactRowsTest {

    private record Item(String rceptNo, String name) {
    }

    private static final Function<Item, String> RCEPT_NO = Item::rceptNo;

    @Test
    @DisplayName("이 보고서 접수번호의 행이 있으면 그 행만 고른다")
    void selectPrefersThisReport() {
        KeyFactRows.Selected<Item> selected = KeyFactRows.select("R1", List.of(new Item("R2", "가"),
                new Item(" R1 ", "나"), new Item("R2", "다")), RCEPT_NO);

        assertThat(selected.items()).extracting(Item::name).containsExactly("나");
        assertThat(selected.sourceRceptNo("R1")).isNull();
    }

    @Test
    @DisplayName("없으면 접수번호가 있는 첫 행의 공시(정정본)를 고르고 그 접수번호를 남긴다")
    void selectFallsBackToFirstFiling() {
        KeyFactRows.Selected<Item> selected = KeyFactRows.select("R1", List.of(new Item("-", "가"),
                new Item("R2", "나"), new Item("R3", "다"), new Item("R2", "라")), RCEPT_NO);

        assertThat(selected.items()).extracting(Item::name).containsExactly("나", "라");
        assertThat(selected.sourceRceptNo("R1")).isEqualTo("R2");
        assertThat(KeyFactRows.select("R1", List.of(new Item(null, "가")), RCEPT_NO).items()).isEmpty();
    }

    @Test
    @DisplayName("값은 앞뒤 공백을 지우고 '-'·빈 값은 null, 이름은 공백을 하나로, 날짜는 읽지 못하면 null이다")
    void valuesAreCleaned() {
        assertThat(KeyFactRows.clean(" 1,000 ")).isEqualTo("1,000");
        assertThat(KeyFactRows.clean(" - ")).isNull();
        assertThat(KeyFactRows.name("홍\n 길동")).isEqualTo("홍 길동");
        assertThat(KeyFactRows.date("2025-12-31")).isEqualTo(LocalDate.of(2025, 12, 31));
        assertThat(KeyFactRows.date("2025.12.31")).isNull();
        assertThat(KeyFactRows.samePeriod(LocalDate.of(2025, 12, 31), LocalDate.of(2025, 6, 30))).isFalse();
        assertThat(KeyFactRows.samePeriod(null, LocalDate.of(2025, 6, 30))).isTrue();
    }
}
