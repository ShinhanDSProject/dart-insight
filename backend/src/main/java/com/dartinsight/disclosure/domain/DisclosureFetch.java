package com.dartinsight.disclosure.domain;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 기업의 최근 공시 목록을 받은 기록(company_disclosure_fetch 한 행).
 *
 * @param fromDate  받은 접수일 기간 시작
 * @param toDate    받은 접수일 기간 끝(받은 날)
 * @param fetchedAt 받은 시각
 */
public record DisclosureFetch(String corpCode, LocalDate fromDate, LocalDate toDate, LocalDateTime fetchedAt) {

    /** 받은 지 refreshAfter가 지나지 않았고, 받은 기간이 from부터를 덮으면 다시 받지 않아도 된다(ADR-0024). */
    public boolean covers(LocalDate from, LocalDateTime now, Duration refreshAfter) {
        return fetchedAt.isAfter(now.minus(refreshAfter)) && !fromDate.isAfter(from);
    }
}
