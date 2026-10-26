package com.dartinsight.financial.domain;

import java.time.LocalDateTime;

/**
 * 보고서 하나의 주요계정을 받은 기록(report_key_account_fetch). 받으면 다시 받지 않는다(ADR-0024).
 *
 * @param status        OK 자료 있음, NO_DATA 자료 없음(013)
 * @param sourceRceptNo 응답에 담긴 접수번호. 자료가 없으면 null
 */
public record KeyAccountFetch(String rceptNo, FetchStatus status, String sourceRceptNo, LocalDateTime fetchedAt) {
}
