package com.dartinsight.agent.domain;

/**
 * Tool 결과의 한 줄. text는 backend가 저장된 자료로 만든 글이고 ai-server에 그대로 간다.
 *
 * @param evidence 답의 근거로 쓸 수 있는 위치. 근거로 쓰지 않는 줄이면 null
 */
public record ToolLine(Evidence evidence, String text) {

    public String evidenceId() {
        return evidence == null ? null : evidence.evidenceId();
    }
}
