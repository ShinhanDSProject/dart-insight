package com.dartinsight.agent.dto;

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
     */
    public record Item(String evidenceId, String text, String grade) {
    }
}
