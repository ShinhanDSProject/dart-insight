package com.dartinsight.llmquota.domain;

/** 따로 세는 하루 한도의 종류(ADR-0054·0056·0069). 이름은 안내 메시지에 쓴다 */
public enum QuotaKind {
    QUESTION("AI 질문"),
    ANALYSIS("새 분석"),
    EXPLANATION("AI 한 줄 풀이");

    private final String label;

    QuotaKind(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }
}
