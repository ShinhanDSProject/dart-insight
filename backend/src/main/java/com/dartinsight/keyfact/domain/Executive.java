package com.dartinsight.keyfact.domain;

/** 임원 현황 한 줄. 값은 원문 표기 그대로이고 '-'·빈 값은 null이다. */
public record Executive(
        String name,
        String position,
        String registeredType,
        String fullTime,
        String duty,
        String largestShareholderRelation,
        String tenure,
        String termEnd) {
}
