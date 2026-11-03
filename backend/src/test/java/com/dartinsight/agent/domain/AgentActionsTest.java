package com.dartinsight.agent.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class AgentActionsTest {

    @Test
    @DisplayName("버튼 문구는 종류(탭)별로 정하고, 중첩 필드의 null은 뺀다")
    void labelsActionsAndDropsNulls() {
        Map<String, Object> filters = new HashMap<>();
        filters.put("q", "소송");
        filters.put("risk", null);
        Map<String, Object> action = new HashMap<>();
        action.put("type", AgentActions.OPEN_TAB);
        action.put("tab", "financial");
        action.put("filters", filters);

        Map<String, Object> labeled = AgentActions.withLabel(action);

        assertThat(labeled).containsEntry("label", "재무 수치에서 보기").containsEntry("filters", Map.of("q", "소송"));
    }

    @Test
    @DisplayName("스키마는 모두 type object·properties·additionalProperties false다(엄격 구조화 출력)")
    void schemasFitStrictStructuredOutput() {
        assertThat(AgentActions.SPECS.values()).allSatisfy(schema -> assertThat(schema)
                .containsEntry("type", "object").containsKey("properties")
                .containsEntry("additionalProperties", false));
        assertThat(AgentActions.known("DELETE_POST")).isFalse();
    }
}
