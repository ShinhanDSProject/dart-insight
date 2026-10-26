package com.dartinsight.financial.domain;

/**
 * 보고서 하나의 주요계정 값 한 줄(report_key_account). 금액이 없으면 null이고 0과 구분한다.
 *
 * @param amount           당기금액(thstrm_amount). 재무상태표는 기말 잔액, 손익은 분·반기 3개월·사업보고서 1년
 * @param cumulativeAmount 당기누적금액(thstrm_add_amount). 분·반기 손익에만 온다
 */
public record KeyAccountRow(String rceptNo, FsDiv fsDiv, KeyAccount account, String sjDiv, String accountName,
        Integer ord, Long amount, Long cumulativeAmount, String currency) {
}
