package com.dartinsight.financial.dto;

import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.financial.domain.FsDiv;
import com.dartinsight.financial.domain.KeyAccount;
import com.dartinsight.financial.domain.TrendValue;
import com.dartinsight.financial.service.FinancialTrendService.FinancialTrend;
import com.dartinsight.financial.service.FinancialTrendService.TrendDataStatus;
import com.dartinsight.financial.service.FinancialTrendService.TrendPeriod;
import com.dartinsight.report.domain.DartLinks;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.domain.ReportType;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;

/**
 * 주요 재무 흐름(docs/api-spec.md GET /api/companies/{corpCode}/financial-trends).
 * accounts는 늘 같은 계정이 같은 순서로 있고, values는 periods와 같은 순서·같은 길이다.
 */
public record FinancialTrendResponse(String corpCode, FsDiv fsDiv, ErrorCode refreshError, List<Period> periods,
        List<Account> accounts) {

    public static FinancialTrendResponse from(FinancialTrend trend) {
        List<Period> periods = trend.periods().stream().map(Period::from).toList();
        List<Account> accounts = Arrays.stream(KeyAccount.values())
                .map(account -> Account.of(account, trend.periods()))
                .toList();
        return new FinancialTrendResponse(trend.corpCode(), trend.fsDiv(), trend.refreshError(), periods, accounts);
    }

    public record Period(String rceptNo, ReportType reportType, String reportName, int fiscalYear,
            LocalDate periodEnd, TrendDataStatus dataStatus, String sourceRceptNo, String dartUrl) {

        static Period from(TrendPeriod period) {
            Report report = period.report();
            return new Period(report.getRceptNo(), report.getReportType(), report.getReportName(),
                    report.getFiscalYear(), report.getPeriodEnd(), period.status(), period.sourceRceptNo(),
                    DartLinks.viewer(report.getRceptNo()));
        }
    }

    /** @param amountBasis POINT 시점(재무상태표), CUMULATIVE 누적(손익의 amount) */
    public record Account(KeyAccount key, String name, String sjDiv, String amountBasis, List<Value> values) {

        static Account of(KeyAccount account, List<TrendPeriod> periods) {
            List<Value> values = periods.stream()
                    .map(p -> Value.of(p.report().getRceptNo(), p.values().get(account)))
                    .toList();
            return new Account(account, account.label(), account.sjDiv(),
                    account.isBalanceSheet() ? "POINT" : "CUMULATIVE", values);
        }
    }

    /** 금액이 없으면 null(0과 구분) */
    public record Value(String rceptNo, Long amount, Long quarterAmount, String currency) {

        static Value of(String rceptNo, TrendValue value) {
            return value == null ? new Value(rceptNo, null, null, null)
                    : new Value(rceptNo, value.amount(), value.quarterAmount(), value.currency());
        }
    }
}
