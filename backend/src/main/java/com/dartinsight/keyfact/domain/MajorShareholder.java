package com.dartinsight.keyfact.domain;

/** 최대주주 현황 한 줄. 값은 원문 표기 그대로이고 '-'·빈 값은 null이다. */
public record MajorShareholder(
        String name,
        String relation,
        String stockKind,
        String beginShares,
        String beginRatio,
        String endShares,
        String endRatio,
        String remark) {
}
