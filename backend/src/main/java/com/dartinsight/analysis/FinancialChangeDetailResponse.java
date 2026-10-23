package com.dartinsight.analysis;

import com.dartinsight.comparison.AmountBasis;
import com.dartinsight.financial.domain.FsDiv;
import com.dartinsight.report.DartLinks;
import com.dartinsight.report.Report;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.LocalDate;
import java.util.Locale;

/**
 * @param formula     증감액 계산식(원 단위). 계산하지 않았으면 null
 * @param rateFormula 증감률 계산식. 계산하지 않았으면 null
 * @param previous    이전 값의 근거. 이전 보고서에 없는 계정이면 null
 * @param current     현재 값의 근거. 현재 보고서에 없는 계정이면 null
 */
public record FinancialChangeDetailResponse(
        Long changeId,
        String sjDiv,
        String accountName,
        String accountKey,
        FsDiv fsDiv,
        AmountBasis amountBasis,
        Long previousAmount,
        Long currentAmount,
        Long changeAmount,
        BigDecimal changeRate,
        String direction,
        CalcStatus calcStatus,
        String calcMessage,
        String currency,
        String formula,
        String rateFormula,
        Source previous,
        Source current) {

    static FinancialChangeDetailResponse of(FinancialChange c, Report previous, Report current) {
        return new FinancialChangeDetailResponse(c.getId(), c.getSjDiv(), c.getAccountName(), c.getAccountKey(),
                c.getFsDiv(), c.getAmountBasis(), c.getPreviousAmount(), c.getCurrentAmount(), c.getChangeAmount(),
                c.getChangeRate(), c.direction(), c.getCalcStatus(), c.getCalcStatus().message(), c.getCurrency(),
                formula(c), rateFormula(c),
                c.getPreviousRceptNo() == null ? null : Source.of(previous, c.getSjDiv(), c.getPreviousAccountId(),
                        c.getPreviousPeriodName()),
                c.getCurrentRceptNo() == null ? null : Source.of(current, c.getSjDiv(), c.getCurrentAccountId(),
                        c.getCurrentPeriodName()));
    }

    /** 증감액 계산식(원 단위). 계산하지 않았으면 null */
    private static String formula(FinancialChange c) {
        if (c.getChangeAmount() == null) {
            return null;
        }
        return won(c.getCurrentAmount()) + " − " + won(c.getPreviousAmount()) + " = " + won(c.getChangeAmount());
    }

    /**
     * 증감률 계산식. 계산하지 않았으면 null.
     * 저장된 증감률(소수 6자리)을 다시 반올림하면 식의 숫자와 어긋날 수 있어, 식에 적는 두 금액으로 바로 계산한다.
     */
    private static String rateFormula(FinancialChange c) {
        if (c.getChangeRate() == null) {
            return null;
        }
        BigDecimal percent = BigDecimal.valueOf(c.getChangeAmount()).movePointRight(2)
                .divide(BigDecimal.valueOf(c.getPreviousAmount()), 2, RoundingMode.HALF_UP);
        return won(c.getChangeAmount()) + " ÷ " + won(c.getPreviousAmount()) + " × 100 = " + percent.toPlainString()
                + "%";
    }

    private static String won(Long amount) {
        // 서버 지역 설정과 관계없이 쉼표로 끊는다
        return new DecimalFormat("#,##0", DecimalFormatSymbols.getInstance(Locale.ROOT)).format(amount)
                .replace("-", "−");
    }

    /**
     * 수치의 원천: 보고서와 재무제표 안의 계정.
     *
     * @param periodName 재무제표 API의 당기 이름(예: 제 57 기 반기)
     */
    public record Source(String rceptNo, String reportName, int fiscalYear, LocalDate periodEnd, String periodName,
            String sjDiv, String accountId, String dartUrl) {

        static Source of(Report report, String sjDiv, String accountId, String periodName) {
            return new Source(report.getRceptNo(), report.getReportName(), report.getFiscalYear(),
                    report.getPeriodEnd(), periodName, sjDiv, accountId, DartLinks.viewer(report.getRceptNo()));
        }
    }
}
