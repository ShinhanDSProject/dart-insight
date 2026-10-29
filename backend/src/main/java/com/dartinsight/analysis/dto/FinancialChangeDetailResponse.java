package com.dartinsight.analysis.dto;

import com.dartinsight.analysis.domain.CalcStatus;
import com.dartinsight.analysis.domain.ChangeScale;
import com.dartinsight.analysis.domain.ChangeScale.Base;
import com.dartinsight.analysis.domain.ChangeScale.Reason;
import com.dartinsight.analysis.domain.FinancialChange;
import com.dartinsight.comparison.domain.AmountBasis;
import com.dartinsight.financial.domain.FsDiv;
import com.dartinsight.report.domain.DartLinks;
import com.dartinsight.report.domain.Report;
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
 * @param scale       증감액의 크기 맥락과 계산식(#480)
 */
public record FinancialChangeDetailResponse(
        Long changeId,
        String sjDiv,
        String accountName,
        String accountDetail,
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
        Source current,
        ScaleDetail scale) {

    public static FinancialChangeDetailResponse of(FinancialChange c, ChangeScale scale, Report previous,
            Report current) {
        return new FinancialChangeDetailResponse(c.getId(), c.getSjDiv(), c.getAccountName(), c.getAccountDetail(),
                c.getAccountKey(),
                c.getFsDiv(), c.getAmountBasis(), c.getPreviousAmount(), c.getCurrentAmount(), c.getChangeAmount(),
                c.getChangeRate(), c.direction(), c.getCalcStatus(), c.getCalcStatus().message(), c.getCurrency(),
                formula(c), rateFormula(c),
                c.getPreviousRceptNo() == null ? null : Source.of(previous, c.getSjDiv(), c.getPreviousAccountId(),
                        c.getPreviousPeriodName()),
                c.getCurrentRceptNo() == null ? null : Source.of(current, c.getSjDiv(), c.getCurrentAccountId(),
                        c.getCurrentPeriodName()),
                ScaleDetail.of(c, scale, current));
    }

    /** 증감액 계산식(원 단위). 금액마다 그 보고서의 기간 이름을 붙인다(#144). 계산하지 않았으면 null */
    private static String formula(FinancialChange c) {
        if (c.getChangeAmount() == null) {
            return null;
        }
        return term(c.getCurrentAmount(), c.getCurrentPeriodName()) + " − "
                + term(c.getPreviousAmount(), c.getPreviousPeriodName()) + " = " + won(c.getChangeAmount());
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
        return won(c.getChangeAmount()) + " ÷ " + term(c.getPreviousAmount(), c.getPreviousPeriodName()) + " × 100 = "
                + percent.toPlainString() + "%";
    }

    /**
     * 크기 맥락과 그 계산식·근거(#480). 목록의 scale에 기준 계정의 changeId, 계산식, 기준 값의 근거를 더한다.
     *
     * @param baseChangeId 기준 계정의 changeId. 찾지 못하면 null
     * @param formula      증감액 ÷ 기준 값(기간 이름) × 100 = 퍼센트. 비율을 계산하지 않았으면 null
     * @param baseSource   기준 값의 근거(현재 보고서). 찾지 못하면 null
     */
    public record ScaleDetail(Base base, String baseAccountName, Long baseAmount, BigDecimal ratio, Reason reason,
            Long baseChangeId, String formula, Source baseSource) {

        static ScaleDetail of(FinancialChange c, ChangeScale scale, Report current) {
            FinancialChange baseChange = scale.baseChange();
            if (baseChange == null) {
                return new ScaleDetail(scale.base(), null, null, null, scale.reason(), null, null, null);
            }
            return new ScaleDetail(scale.base(), scale.baseAccountName(), scale.baseAmount(), scale.ratio(),
                    scale.reason(), baseChange.getId(), scaleFormula(c, scale),
                    Source.of(current, baseChange.getSjDiv(), baseChange.getCurrentAccountId(),
                            baseChange.getCurrentPeriodName()));
        }
    }

    /**
     * 크기 계산식. 비율을 계산하지 않았으면 null. 퍼센트는 rateFormula처럼 식에 적는 두 금액으로 바로 계산한다(소수 2자리).
     */
    private static String scaleFormula(FinancialChange c, ChangeScale scale) {
        if (scale.ratio() == null) {
            return null;
        }
        BigDecimal percent = BigDecimal.valueOf(c.getChangeAmount()).movePointRight(2)
                .divide(BigDecimal.valueOf(scale.baseAmount()), 2, RoundingMode.HALF_UP);
        return won(c.getChangeAmount()) + " ÷ " + term(scale.baseAmount(), scale.baseChange().getCurrentPeriodName())
                + " × 100 = " + percent.toPlainString().replace("-", "−") + "%";
    }

    /** 식 안의 금액. 음수는 빼기 기호와 헷갈리지 않게 괄호로 감싸고, 기간 이름이 있으면 괄호로 붙인다 */
    private static String term(Long amount, String periodName) {
        String value = amount < 0 ? "(" + won(amount) + ")" : won(amount);
        return periodName == null || periodName.isBlank() ? value : value + "(" + periodName + ")";
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
