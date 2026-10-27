package com.dartinsight.relateddisclosure.domain;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 분석 하나를 규칙 버전으로 계산한 기록(related_disclosure_run 한 행).
 *
 * @param id            저장된 행 id. 저장 전이면 null
 * @param windowFetchId 쓴 공시 목록(disclosure_window_fetch.id)
 * @param periodEnd     현재 보고서 기간 말일(기간 안·뒤 구분 기준)
 * @param traceId       계산한 요청의 추적 ID. 없으면 null
 */
public record RelatedRun(Long id, long analysisId, String ruleVersion, long windowFetchId, LocalDate periodEnd,
        int linkCount, String traceId, LocalDateTime computedAt) {
}
