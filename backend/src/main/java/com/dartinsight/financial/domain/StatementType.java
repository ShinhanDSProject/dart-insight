package com.dartinsight.financial.domain;

import java.util.Arrays;
import java.util.Optional;

/** 재무제표 종류. OpenDART sj_div 값과 같다. */
public enum StatementType {
    BS("재무상태표"),
    IS("손익계산서"),
    CIS("포괄손익계산서"),
    CF("현금흐름표"),
    SCE("자본변동표");

    private final String label;

    StatementType(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }

    public static Optional<StatementType> of(String sjDiv) {
        return Arrays.stream(values()).filter(t -> t.name().equals(sjDiv)).findFirst();
    }
}
