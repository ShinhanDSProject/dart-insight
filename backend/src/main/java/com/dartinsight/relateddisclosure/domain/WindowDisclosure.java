package com.dartinsight.relateddisclosure.domain;

import java.time.LocalDate;

/**
 * 기간 안에 받은 수시공시 한 건(disclosure_window_item 한 행). 정정 전 원본도 남는다(비고에 '정').
 *
 * @param id         저장된 행 id. 저장 전이면 null
 * @param detailType 요청한 공시상세유형
 * @param reportName 보고서명 원문(앞뒤 공백만 뺌)
 * @param filerName  제출인. 없으면 null
 * @param remark     비고(rm) 원문. 없으면 null
 */
public record WindowDisclosure(Long id, String rceptNo, DisclosureDetailType detailType, String reportName,
        String filerName, LocalDate rceptDt, String remark) {
}
