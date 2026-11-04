package com.dartinsight.analysis.domain;

import com.dartinsight.report.domain.Report;

/**
 * 관리자 분석 작업 목록의 분석 하나와 기업명·두 보고서.
 *
 * @param corpName 기업 표에 없으면 null
 * @param current 현재 보고서. 저장돼 있지 않으면 null
 * @param previous 이전 보고서. 저장돼 있지 않으면 null
 */
public record AnalysisListing(Analysis analysis, String corpName, Report current, Report previous) {
}
