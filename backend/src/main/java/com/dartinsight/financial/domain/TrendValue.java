package com.dartinsight.financial.domain;

import com.dartinsight.report.domain.ReportType;

/** 주요 재무 흐름의 화면 금액. 금액이 없으면 null(0과 구분) */
public record TrendValue(Long amount, Long quarterAmount, String currency) {

    /**
     * 화면에 보일 금액. 재무상태표는 기말 잔액. 손익의 amount는 사업연도 시작부터의 누적이고 quarterAmount는 3개월이다.
     * 분·반기 손익은 OpenDART 당기금액이 3개월, 당기누적금액이 누적이다. 1분기는 3개월이 곧 누적이고,
     * 사업보고서 당기금액은 1년(누적)이며 OpenDART가 4분기 3개월 값을 주지 않아 quarterAmount가 null이다.
     */
    public static TrendValue of(ReportType type, KeyAccountRow row) {
        if (row.account().isBalanceSheet()) {
            return new TrendValue(row.amount(), null, row.currency());
        }
        return switch (type) {
            case ANNUAL -> new TrendValue(row.amount(), null, row.currency());
            case Q1 -> new TrendValue(row.cumulativeAmount() != null ? row.cumulativeAmount() : row.amount(),
                    row.amount(), row.currency());
            case HALF, Q3 -> new TrendValue(row.cumulativeAmount(), row.amount(), row.currency());
        };
    }
}
