package com.dartinsight.glossary.domain;

import java.util.List;

/**
 * 채팅이 '이 회사에서는' 값을 찾을 곳(ADR-0061). API로는 내보내지 않는다.
 *
 * @param checkpoint 재무 체크 포인트 항목 키(예: DEBT_RATIO). 없으면 null
 * @param accounts   재무 계정 이름(예: 부채총계). 없으면 빈 목록
 */
public record GlossaryCompanyValue(String checkpoint, List<String> accounts) {

    public GlossaryCompanyValue {
        accounts = accounts == null ? List.of() : List.copyOf(accounts);
    }
}
