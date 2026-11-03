package com.dartinsight.agent.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ToolArgsTest {

    private static final Set<String> NAMES = Set.of("q", "size", "risk", "changeId", "sort");

    @Test
    @DisplayName("모르는 인자는 실패한다")
    void rejectsUnknownArguments() {
        assertThatThrownBy(() -> ToolArgs.of(Map.of("page", 2), NAMES)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("null은 없는 값으로 보고 기본값을 쓴다")
    void treatsNullAsAbsent() {
        Map<String, Object> values = new HashMap<>();
        values.put("q", null);
        values.put("size", null);
        values.put("risk", null);
        ToolArgs args = ToolArgs.of(values, NAMES);

        assertThat(args.string("q")).isNull();
        assertThat(args.integer("size", 1, 10, 10)).isEqualTo(10);
        assertThat(args.flag("risk")).isFalse();
    }

    @Test
    @DisplayName("타입·범위·선택지가 틀리면 실패하고 필수 ID가 없으면 실패한다")
    void rejectsWrongTypesAndRanges() {
        assertThatThrownBy(() -> ToolArgs.of(Map.of("size", 11), NAMES).integer("size", 1, 10, 10))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> ToolArgs.of(Map.of("risk", "yes"), NAMES).flag("risk"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> ToolArgs.of(Map.of("changeId", "5"), NAMES).requiredId("changeId"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> ToolArgs.of(Map.of(), NAMES).requiredId("changeId"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> ToolArgs.of(Map.of("sort", "random"), NAMES).choice("sort",
                List.of("priority", "document"), "priority")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("정수는 Integer·Long 모두 받는다")
    void acceptsIntegerAndLong() {
        assertThat(ToolArgs.of(Map.of("changeId", 5), NAMES).requiredId("changeId")).isEqualTo(5L);
        assertThat(ToolArgs.of(Map.of("changeId", 5L), NAMES).requiredId("changeId")).isEqualTo(5L);
    }
}
