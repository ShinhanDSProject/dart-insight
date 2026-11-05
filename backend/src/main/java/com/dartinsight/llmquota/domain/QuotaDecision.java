package com.dartinsight.llmquota.domain;

/** 한 번 더 부를 수 있는지. 넘었으면 어느 한도에 걸렸는지 */
public enum QuotaDecision {
    ALLOWED,
    CALLER_EXCEEDED,
    TOTAL_EXCEEDED;

    public boolean allowed() {
        return this == ALLOWED;
    }
}
