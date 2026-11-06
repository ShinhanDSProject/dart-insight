package com.dartinsight.agent.dto;

import com.dartinsight.agent.domain.ToolLine;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;
import java.util.Map;

/** AI 서버 에이전트 한 단계 요청(POST /internal/agent-steps). docs/api-spec.md 3절 */
public record AgentStepAiRequest(String companyName, String previousReport, String currentReport, String message,
        List<Turn> history, Map<String, Object> context, List<Tool> tools, List<Action> actions,
        List<ToolResult> toolResults, int remainingSteps) {

    public record Turn(String role, String text) {
    }

    /** @param parameters 인자의 JSON Schema(object) */
    public record Tool(String name, String description, Map<String, Object> parameters) {
    }

    /** @param parameters type을 뺀 필드의 JSON Schema(object) */
    public record Action(String type, Map<String, Object> parameters) {
    }

    public record ToolResult(String callId, String name, Map<String, Object> arguments, boolean ok, String error,
            boolean truncated, List<Item> items) {
    }

    /**
     * @param evidenceId 답의 근거로 쓸 수 있는 위치. 없으면 null
     * @param grade      저장된 재무 설명 등급(STATED·RELATED·NONE). 없으면 null
     * @param facts      교차 검증 판정용 구조화 값. 없으면 보내지 않음
     */
    public record Item(String evidenceId, String text, String grade,
            @JsonInclude(JsonInclude.Include.NON_NULL) Facts facts) {
    }

    /** 판정용 구조화 값. 값이 없는 필드는 보내지 않는다(요약 줄은 changeId만) */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Facts(Long changeId, String direction, String calcStatus) {

        public static Facts from(ToolLine.Facts facts) {
            return facts == null ? null : new Facts(facts.changeId(), facts.direction(), facts.calcStatus());
        }
    }
}
