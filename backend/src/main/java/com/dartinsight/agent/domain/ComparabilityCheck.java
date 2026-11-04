package com.dartinsight.agent.domain;

import java.util.Map;

/**
 * 채팅 안에서 비교 가능성 Tool(check_comparability)을 실행한 결과. 분석 요청 확인 액션(CONFIRM_REQUEST_ANALYSIS)은
 * 이 채팅에서 같은 네 값으로 비교할 수 있다고 나왔을 때만 내보낸다(AC18, docs/api-spec.md 액션 표).
 */
public record ComparabilityCheck(String corpCode, String previousRceptNo, String currentRceptNo, String basis,
        boolean comparable) {

    /** 분석 요청 액션의 네 값이 이 검증과 같고 비교할 수 있었는지 */
    public boolean allows(Map<String, Object> action) {
        return comparable && corpCode.equals(action.get("corpCode"))
                && previousRceptNo.equals(action.get("previousRceptNo"))
                && currentRceptNo.equals(action.get("currentRceptNo")) && basis.equals(action.get("basis"));
    }
}
