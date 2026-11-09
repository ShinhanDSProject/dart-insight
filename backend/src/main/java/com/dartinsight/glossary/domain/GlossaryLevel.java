package com.dartinsight.glossary.domain;

/**
 * 용어 카드 수준(ADR-0061). 기초 카드 질문에는 채팅이 '한 줄 뜻 + 이 회사 값'만 짧게 답한다.
 */
public enum GlossaryLevel {
    /** 자산·매출 같은 아주 쉬운 용어 */
    BASIC,
    /** 초보자가 꼭 알아야 하는 회계·증권·공시 용어 */
    CORE
}
