package com.dartinsight.relateddisclosure.domain;

import java.time.LocalDate;
import java.util.Objects;

/**
 * 관련 수시공시를 찾는 기간(ADR-0030). 이전 보고서 기간 말일부터 현재 보고서 제출일까지다.
 *
 * @param from      조회 시작(이전 보고서 기간 말일, 공시검색 bgn_de)
 * @param periodEnd 현재 보고서 기간 말일. 이 날 이하면 보고 기간 중(DURING), 뒤면 기간 후~제출 전(AFTER)
 * @param to        조회 끝(현재 보고서 제출일, 공시검색 end_de)
 */
public record DisclosureWindow(String corpCode, LocalDate from, LocalDate periodEnd, LocalDate to) {

    public DisclosureWindow {
        Objects.requireNonNull(corpCode, "corpCode");
        Objects.requireNonNull(from, "from");
        Objects.requireNonNull(periodEnd, "periodEnd");
        Objects.requireNonNull(to, "to");
        if (from.isAfter(to)) {
            throw new IllegalStateException("조회 시작이 조회 끝보다 뒤입니다: " + from + " ~ " + to);
        }
    }
}
