package com.dartinsight.analysis.domain;

import java.math.BigDecimal;

/**
 * 증감액의 크기 맥락(#480, FS-63, docs/api-spec.md 재무 수치 변화 '크기 맥락'). 증감액 ÷ 기준 계정의 현재 값이다.
 * 크기만 보이고 좋고 나쁨은 판단하지 않는다. 저장하지 않고 조회할 때 {@link ChangeScales}가 만든다.
 *
 * @param base       기준 종류
 * @param baseChange 기준으로 쓴 같은 분석의 계정 결과. 찾지 못하면 null
 * @param ratio      증감액 ÷ 기준 값(소수 6자리 반올림). 계산하지 않으면 null
 * @param reason     ratio가 null인 사유. 계산했으면 null
 */
public record ChangeScale(Base base, FinancialChange baseChange, BigDecimal ratio, Reason reason) {

    /** 기준 종류 */
    public enum Base {
        /** 매출액: 손익계산서·포괄손익계산서·현금흐름표 계정 */
        REVENUE,
        /** 자산총계: 재무상태표 계정 */
        TOTAL_ASSETS,
        /** 자본총계: 자본변동표 계정 */
        TOTAL_EQUITY
    }

    /** 비율을 계산하지 않은 사유 */
    public enum Reason {
        /** 증감액이 없음 */
        CHANGE_NOT_CALCULATED,
        /** 기준 계정을 찾지 못함 */
        BASE_NOT_FOUND,
        /** 기준 계정의 현재 값이 없음 */
        BASE_MISSING,
        /** 기준 값이 0 이하 */
        BASE_NOT_POSITIVE
    }

    /** 기준 계정의 이름. 찾지 못하면 null */
    public String baseAccountName() {
        return baseChange == null ? null : baseChange.getAccountName();
    }

    /** 기준 계정의 현재 보고서 값. 찾지 못했거나 값이 없으면 null */
    public Long baseAmount() {
        return baseChange == null ? null : baseChange.getCurrentAmount();
    }
}
