package com.dartinsight.analysis.domain;

import com.dartinsight.report.domain.Report;

/** 완료된 분석과 비교한 두 정기보고서 */
public record CompletedAnalysis(Analysis analysis, Report previous, Report current) {
}
