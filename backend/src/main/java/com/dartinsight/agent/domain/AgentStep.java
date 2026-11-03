package com.dartinsight.agent.domain;

/** AI 서버 에이전트 한 단계의 결과 종류(POST /internal/agent-steps의 type) */
public final class AgentStep {

    public static final String TOOL_CALLS = "TOOL_CALLS";
    public static final String FINAL = "FINAL";
    public static final String OUT_OF_SCOPE = "OUT_OF_SCOPE";
    /** 답 형식. 정리 형식(BRIEF)은 #581 */
    public static final String FORMAT_CHAT = "CHAT";

    private AgentStep() {
    }
}
