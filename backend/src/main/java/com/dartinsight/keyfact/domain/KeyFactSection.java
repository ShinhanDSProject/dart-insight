package com.dartinsight.keyfact.domain;

import java.time.LocalDate;
import java.util.List;

/**
 * 한 보고서의 묶음 결과.
 *
 * @param sourceRceptNo  값을 받은 공시의 접수번호(OpenDART 응답의 rcept_no)가 rceptNo와 다를 때 그 접수번호(정정 공시 값).
 *                       같거나 AVAILABLE이 아니면 null
 * @param settlementDate 결산기준일(stlm_dt). AVAILABLE이 아니면 null
 * @param rows           원문 순서의 행. AVAILABLE이 아니면 빈 목록
 */
public record KeyFactSection<T>(String rceptNo, String sourceRceptNo, KeyFactStatus status, LocalDate settlementDate,
        List<T> rows) {

    public static <T> KeyFactSection<T> empty(String rceptNo, KeyFactStatus status) {
        return new KeyFactSection<>(rceptNo, null, status, null, List.of());
    }

    public boolean available() {
        return status == KeyFactStatus.AVAILABLE;
    }
}
