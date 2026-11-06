package com.dartinsight.textevent.domain;

/** 용어 풀이 하나. 기준표 용어 중 출처를 확인한 것만 쓴다(ADR-0060). */
public record GlossaryTerm(String term, String meaning, String source) {
}
