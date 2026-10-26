package com.dartinsight.keyfact.domain;

import java.time.LocalDate;
import java.util.List;

/**
 * 한 보고서의 묶음 결과.
 *
 * @param settlementDate 결산기준일(stlm_dt). AVAILABLE이 아니면 null
 * @param rows           원문 순서의 행. AVAILABLE이 아니면 빈 목록
 */
public record KeyFactSection<T>(String rceptNo, KeyFactStatus status, LocalDate settlementDate, List<T> rows) {

    public static <T> KeyFactSection<T> empty(String rceptNo, KeyFactStatus status) {
        return new KeyFactSection<>(rceptNo, status, null, List.of());
    }

    public boolean available() {
        return status == KeyFactStatus.AVAILABLE;
    }
}
