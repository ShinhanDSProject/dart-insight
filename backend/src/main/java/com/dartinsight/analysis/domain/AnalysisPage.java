package com.dartinsight.analysis.domain;

import java.util.List;

/** 관리자 분석 작업 목록 한 쪽 */
public record AnalysisPage(int page, int size, long totalItems, List<AnalysisListing> items) {

    public AnalysisPage {
        items = List.copyOf(items);
    }
}
