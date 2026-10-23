package com.dartinsight.summary.domain;

import java.util.List;

/** 요약 결과. 분석 결과와 같은 트랜잭션에서 저장한다. */
public record SummaryResult(SummaryStatus status, String message, List<SummaryItemRow> items,
        List<LlmCallRow> calls) {

    public static SummaryResult empty(String message) {
        return new SummaryResult(SummaryStatus.EMPTY, message, List.of(), List.of());
    }
}
