package com.dartinsight.textevent.domain;

import com.dartinsight.disclosure.domain.KeyItemKind;

/**
 * 주요사항보고서(DS005) 결정 하나의 금액.
 *
 * @param field OpenDART 응답 필드 이름. 항목 여럿을 더했으면 공통 앞부분(예: fdpp)
 */
public record StructuredAmount(String rceptNo, KeyItemKind kind, String field, long amount, String currency) {

    public String evidenceId() {
        return rceptNo + "#" + field;
    }
}
