package com.dartinsight.agent.domain;

import java.util.Set;

/**
 * 채팅에서 LLM이 고른 Tool 실행 하나. 저장 확인만 하는 요청인지 가리는 데 쓴다(AgentActions.onlySaves).
 *
 * @param locatesChange 변경 목록·변경 하나를 찾는 Tool인지(설명·요약·질문·원문 Tool은 아님). 노트에 담을 대상을 찾는 데 쓸 수 있는 Tool이다
 * @param evidenceIds   그 결과의 근거 ID
 */
public record ToolLookup(boolean locatesChange, Set<String> evidenceIds) {

    public ToolLookup {
        evidenceIds = Set.copyOf(evidenceIds);
    }
}
