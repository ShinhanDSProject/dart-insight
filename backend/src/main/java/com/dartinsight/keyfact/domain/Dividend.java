package com.dartinsight.keyfact.domain;

/** 배당에 관한 사항 한 줄. 당기·전기·전전기 값은 원문 표기 그대로이고 '-'·빈 값은 null이다. */
public record Dividend(
        String category,
        String stockKind,
        String currentTerm,
        String priorTerm,
        String twoTermsAgo) {
}
