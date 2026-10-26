package com.dartinsight.relateddisclosure.domain;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 기간 공시 목록을 받은 기록(disclosure_window_fetch 한 행).
 *
 * @param id        저장된 행 id. 저장 전이면 null
 * @param beginDate 조회 시작(bgn_de)
 * @param endDate   조회 끝(end_de)
 * @param fetchedAt 받은 시각
 */
public record WindowFetch(Long id, String corpCode, LocalDate beginDate, LocalDate endDate, WindowFetchStatus status,
        LocalDateTime fetchedAt) {
}
