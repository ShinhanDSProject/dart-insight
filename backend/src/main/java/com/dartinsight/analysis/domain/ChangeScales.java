package com.dartinsight.analysis.domain;

import com.dartinsight.analysis.domain.ChangeScale.Base;
import com.dartinsight.analysis.domain.ChangeScale.Reason;
import com.dartinsight.financial.domain.KeyAccount;
import com.dartinsight.financial.domain.StatementType;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * 한 분석의 계정 결과로 증감액의 크기 맥락을 계산한다(#480, FS-63). 규칙은 docs/api-spec.md 재무 수치 변화 '크기 맥락'.
 * <ul>
 *   <li>기준: 손익계산서·포괄손익계산서·현금흐름표 계정은 매출액, 재무상태표 계정은 자산총계, 자본변동표 계정은 자본총계.
 *       모두 같은 분석(같은 연결·별도 구분)의 현재 보고서 값이다.</li>
 *   <li>기준 계정 찾기: 현재 보고서 계정 ID가 확인된 표준계정({@link #REVENUE_ACCOUNT_ID}, {@link #ASSETS_ACCOUNT_ID},
 *       {@link #EQUITY_ACCOUNT_ID})이면
 *       그 계정, 없으면 계정명이 주요계정({@link KeyAccount})의 이름과 같은 계정. 재무제표 안에서는 원문 순서 첫 번째.
 *       추측한 계정 ID는 넣지 않는다.</li>
 *   <li>비율 = 증감액 ÷ 기준 값, 소수 6자리 반올림(HALF_UP). 증감액이 없거나 기준 값이 없거나 0 이하면 null과 사유.</li>
 * </ul>
 * 저장하지 않고 조회 때 계산하므로 Analysis.CURRENT_VERSION과 관계없다.
 */
public final class ChangeScales {

    static final int RATIO_SCALE = 6;

    /** 매출액 표준계정 ID. 매출액·매출·영업수익으로 쓰인다(ADR-0015, AccountAliases) */
    static final String REVENUE_ACCOUNT_ID = "ifrs-full_Revenue";

    /** 자산총계 표준계정 ID(AccountAliases) */
    static final String ASSETS_ACCOUNT_ID = "ifrs-full_Assets";

    /** 자본총계 표준계정 ID. 삼성전자 2026 반기보고서(20260814003699) 재무상태표 '자본총계' 행으로 확인 */
    static final String EQUITY_ACCOUNT_ID = "ifrs-full_Equity";

    private final List<FinancialChange> changes;

    private ChangeScales(List<FinancialChange> changes) {
        this.changes = changes.stream()
                .sorted(Comparator.comparingInt(FinancialChange::getDisplayOrder))
                .toList();
    }

    /** @param changes 한 분석의 모든 계정 결과 */
    public static ChangeScales of(List<FinancialChange> changes) {
        return new ChangeScales(changes);
    }

    /** 계정 하나의 크기 맥락 */
    public ChangeScale scaleOf(FinancialChange change) {
        Base base = baseOf(change.getSjDiv());
        FinancialChange baseChange = findBase(base, change.getSjDiv()).orElse(null);
        Reason reason = reason(change.getChangeAmount(), baseChange);
        BigDecimal ratio = reason == null ? ratio(change.getChangeAmount(), baseChange.getCurrentAmount()) : null;
        return new ChangeScale(base, baseChange, ratio, reason);
    }

    /**
     * 규모 큰 순: 비율의 절댓값이 큰 것부터, 같으면 받은 순서. 비율이 없는 항목은 맨 뒤에 받은 순서로 둔다.
     * 받은 목록은 바꾸지 않는다.
     */
    public List<FinancialChange> sortByScale(List<FinancialChange> items) {
        Map<FinancialChange, BigDecimal> sizes = new IdentityHashMap<>();
        List<FinancialChange> calculated = new ArrayList<>();
        List<FinancialChange> uncalculated = new ArrayList<>();
        for (FinancialChange item : items) {
            BigDecimal ratio = scaleOf(item).ratio();
            if (ratio == null) {
                uncalculated.add(item);
            } else {
                sizes.put(item, ratio.abs());
                calculated.add(item);
            }
        }
        // List.sort는 안정 정렬이라 크기가 같으면 받은 순서를 지킨다
        calculated.sort(Comparator.comparing(sizes::get, Comparator.reverseOrder()));
        calculated.addAll(uncalculated);
        return calculated;
    }

    static Base baseOf(String sjDiv) {
        StatementType type = StatementType.of(sjDiv)
                .orElseThrow(() -> new IllegalStateException("알 수 없는 재무제표 종류: " + sjDiv));
        return switch (type) {
            case BS -> Base.TOTAL_ASSETS;
            case SCE -> Base.TOTAL_EQUITY;
            case IS, CIS, CF -> Base.REVENUE;
        };
    }

    /** 기준 계정을 찾을 재무제표 순서 */
    static List<StatementType> baseStatements(Base base, String sjDiv) {
        return switch (base) {
            case TOTAL_ASSETS, TOTAL_EQUITY -> List.of(StatementType.BS);
            case REVENUE -> switch (sjDiv) {
                case "IS" -> List.of(StatementType.IS);
                case "CIS" -> List.of(StatementType.CIS, StatementType.IS);
                default -> List.of(StatementType.IS, StatementType.CIS);
            };
        };
    }

    private Optional<FinancialChange> findBase(Base base, String sjDiv) {
        for (StatementType type : baseStatements(base, sjDiv)) {
            List<FinancialChange> rows = changes.stream()
                    .filter(c -> c.getSjDiv().equals(type.name()) && c.getCurrentRceptNo() != null)
                    .toList();
            Optional<FinancialChange> found = byAccountId(rows, base).or(() -> byName(rows, base));
            if (found.isPresent()) {
                return found;
            }
        }
        return Optional.empty();
    }

    private static Optional<FinancialChange> byAccountId(List<FinancialChange> rows, Base base) {
        Set<String> ids = switch (base) {
            case REVENUE -> Set.of(REVENUE_ACCOUNT_ID);
            case TOTAL_ASSETS -> Set.of(ASSETS_ACCOUNT_ID);
            case TOTAL_EQUITY -> Set.of(EQUITY_ACCOUNT_ID);
        };
        return rows.stream().filter(c -> ids.contains(c.getCurrentAccountId())).findFirst();
    }

    private static Optional<FinancialChange> byName(List<FinancialChange> rows, Base base) {
        KeyAccount key = KeyAccount.valueOf(base.name());
        return rows.stream()
                .filter(c -> KeyAccount.fromAccountName(c.getAccountName()).filter(key::equals).isPresent())
                .findFirst();
    }

    /** 비율 = 증감액 ÷ 기준 값(소수 6자리 반올림) */
    static BigDecimal ratio(long changeAmount, long baseAmount) {
        return BigDecimal.valueOf(changeAmount).divide(BigDecimal.valueOf(baseAmount), RATIO_SCALE,
                RoundingMode.HALF_UP);
    }

    /** 사유 판정(순서는 docs/api-spec.md '크기 맥락'). 계산할 수 있으면 null */
    static Reason reason(Long changeAmount, FinancialChange baseChange) {
        if (changeAmount == null) {
            return Reason.CHANGE_NOT_CALCULATED;
        }
        if (baseChange == null) {
            return Reason.BASE_NOT_FOUND;
        }
        if (baseChange.getCurrentAmount() == null) {
            return Reason.BASE_MISSING;
        }
        return baseChange.getCurrentAmount() <= 0 ? Reason.BASE_NOT_POSITIVE : null;
    }
}
