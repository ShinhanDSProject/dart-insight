package com.dartinsight.agent.domain;

import java.util.Map;

/**
 * 채팅 안에서 비교 가능성 Tool(check_comparability)을 실행한 결과. 분석 요청 확인 액션(CONFIRM_REQUEST_ANALYSIS)은
 * 이 채팅에서 같은 네 값으로 비교할 수 있다고 나왔고, 같은 보고서 쌍의 완료된 분석이 없을 때만 내보낸다
 * (AC18: 끝난 분석이 있으면 OPEN_ANALYSIS, docs/api-spec.md 액션 표).
 *
 * @param existingAnalysisId 같은 보고서 쌍(이전·현재 접수번호)의 완료된 분석. 없으면 null
 */
public record ComparabilityCheck(String corpCode, String previousRceptNo, String currentRceptNo, String basis,
        boolean comparable, Long existingAnalysisId) {

    /** 분석 요청 액션의 네 값이 이 검증과 같고, 비교할 수 있었고, 같은 쌍의 끝난 분석이 없는지 */
    public boolean allows(Map<String, Object> action) {
        return comparable && existingAnalysisId == null && corpCode.equals(action.get("corpCode"))
                && previousRceptNo.equals(action.get("previousRceptNo"))
                && currentRceptNo.equals(action.get("currentRceptNo")) && basis.equals(action.get("basis"));
    }
}
