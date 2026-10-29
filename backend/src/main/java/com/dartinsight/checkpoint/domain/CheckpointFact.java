package com.dartinsight.checkpoint.domain;

import com.dartinsight.financial.domain.FsDiv;
import java.math.BigDecimal;

/**
 * 체크 포인트 계산에 쓴 값 하나(docs/api-spec.md {@code facts[]}).
 *
 * @param value    값이 없거나 계산하지 않았으면 null(0과 구분). 그때 reason이 이유다
 * @param currency 금액(AMOUNT)일 때 통화, 아니면 null
 * @param evidence 재무제표 계정 값이면 그 계정, 계산한 값·건수면 null
 */
public record CheckpointFact(String label, BigDecimal value, Unit unit, String currency, Reason reason,
        Evidence evidence) {

    public enum Unit {
        AMOUNT, PERCENT, PERCENT_POINT, COUNT
    }

    /** 값이 null인 이유 */
    public enum Reason {
        /** 계정을 찾지 못함·자료 없음 */
        MISSING,
        /** 작년 값이 0이라 증가율을 계산하지 않음 */
        PREVIOUS_ZERO,
        /** 작년 값이 음수라 증가율을 계산하지 않음 */
        PREVIOUS_NEGATIVE,
        /** 자본총계가 0 이하라 부채비율을 계산하지 않음 */
        EQUITY_NOT_POSITIVE,
        /** 자료를 받지 못해 세지 못함 */
        NOT_CHECKED
    }

    /**
     * 재무제표 계정 근거.
     *
     * @param rceptNo OpenDART 응답의 접수번호
     */
    public record Evidence(String rceptNo, FsDiv fsDiv, String sjDiv, String statementName, String accountId,
            String accountName) {
    }

    public static CheckpointFact amount(String label, AccountValue value) {
        if (value == null || value.amount() == null) {
            return new CheckpointFact(label, null, Unit.AMOUNT, value == null ? null : value.currency(), Reason.MISSING,
                    value == null ? null : value.evidence());
        }
        return new CheckpointFact(label, BigDecimal.valueOf(value.amount()), Unit.AMOUNT, value.currency(), null,
                value.evidence());
    }

    /** 합계처럼 계정 하나로 가리킬 수 없는 금액 */
    public static CheckpointFact sum(String label, Long amount, String currency) {
        return amount == null ? new CheckpointFact(label, null, Unit.AMOUNT, currency, Reason.MISSING, null)
                : new CheckpointFact(label, BigDecimal.valueOf(amount), Unit.AMOUNT, currency, null, null);
    }

    public static CheckpointFact rate(String label, Rate rate) {
        return new CheckpointFact(label, rate.value(), Unit.PERCENT, null, rate.reason(), null);
    }

    public static CheckpointFact points(String label, Rate rate) {
        return new CheckpointFact(label, rate.value(), Unit.PERCENT_POINT, null, rate.reason(), null);
    }

    public static CheckpointFact count(String label, Integer count) {
        return count == null ? new CheckpointFact(label, null, Unit.COUNT, null, Reason.NOT_CHECKED, null)
                : new CheckpointFact(label, BigDecimal.valueOf(count), Unit.COUNT, null, null, null);
    }
}
