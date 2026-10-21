package com.dartinsight.analysis;

import com.dartinsight.analysis.FinancialChangeRow.Evidence;
import com.dartinsight.comparison.AmountBasis;
import com.dartinsight.comparison.StatementRules.StatementRule;
import com.dartinsight.financial.FinancialAccount;
import com.dartinsight.financial.FsDiv;
import com.dartinsight.financial.StatementType;
import com.dartinsight.report.ReportType;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 두 보고서의 재무제표 계정 값을 맞춰 증감액·증감률을 계산한다(2.4). 계산은 코드가 하고 LLM을 쓰지 않는다.
 *
 * <ul>
 *   <li>계정 대응: 표준계정코드(account_id)가 같으면 같은 계정이다. 표준계정이 아니면 정규화한 계정명으로 맞춘다.
 *       자본변동표는 계정 상세(account_detail)까지 같아야 한다. 같은 키가 한 재무제표에 여러 번 나오면 순서로 구분한다.</li>
 *   <li>이전 값: 이전 보고서의 원래 값(잠정안, 결정 로그 '이전 값 기준').</li>
 *   <li>금액 기준: 비교 규칙(StatementRules)이 정한 시점·누적·3개월 금액.</li>
 *   <li>증감액 = 현재 값 − 이전 값. 증감률 = 증감액 ÷ 이전 값(이전 값이 양수일 때만, 소수 6자리 반올림).</li>
 *   <li>순서: 현재 보고서의 원문 순서(ord), 이전 보고서에만 있는 계정은 그 뒤에 이전 보고서 순서로.</li>
 * </ul>
 */
public final class FinancialComparator {

    static final int RATE_SCALE = 6;

    private FinancialComparator() {
    }

    public record Side(ReportType reportType, List<FinancialAccount> accounts) {
    }

    public static List<FinancialChangeRow> compare(FsDiv fsDiv, List<StatementRule> rules, Side previous,
            Side current) {
        List<FinancialChangeRow> rows = new ArrayList<>();
        for (StatementRule rule : rules) {
            String sjDiv = rule.type().name();
            Map<String, FinancialAccount> prev = keyed(accountsOf(previous, sjDiv), rule.type());
            Map<String, FinancialAccount> cur = keyed(accountsOf(current, sjDiv), rule.type());
            int order = 0;
            for (Map.Entry<String, FinancialAccount> entry : cur.entrySet()) {
                rows.add(row(fsDiv, rule, entry.getKey(), prev.get(entry.getKey()), entry.getValue(),
                        previous.reportType(), current.reportType(), order++));
            }
            for (Map.Entry<String, FinancialAccount> entry : prev.entrySet()) {
                if (!cur.containsKey(entry.getKey())) {
                    rows.add(row(fsDiv, rule, entry.getKey(), entry.getValue(), null, previous.reportType(),
                            current.reportType(), order++));
                }
            }
        }
        return rows;
    }

    private static List<FinancialAccount> accountsOf(Side side, String sjDiv) {
        return side.accounts().stream()
                .filter(a -> sjDiv.equals(a.getSjDiv()))
                .sorted(Comparator.comparing((FinancialAccount a) -> a.getOrd() == null ? Integer.MAX_VALUE : a.getOrd())
                        .thenComparing(a -> a.getId() == null ? Long.MAX_VALUE : a.getId()))
                .toList();
    }

    /** 원문 순서를 지키며 계정 키를 붙인다. 같은 키가 또 나오면 "#2", "#3"을 붙인다. */
    static Map<String, FinancialAccount> keyed(List<FinancialAccount> accounts, StatementType type) {
        Map<String, FinancialAccount> result = new LinkedHashMap<>();
        Map<String, Integer> seen = new HashMap<>();
        for (FinancialAccount account : accounts) {
            String base = accountKey(account, type);
            int n = seen.merge(base, 1, Integer::sum);
            result.put(n == 1 ? base : base + "#" + n, account);
        }
        return result;
    }

    static String accountKey(FinancialAccount account, StatementType type) {
        String key = account.isStandardAccount() ? account.getAccountId() : "NAME:" + normalize(account.getAccountName());
        if (type == StatementType.SCE && account.getAccountDetail() != null) {
            key = key + "|" + normalize(account.getAccountDetail());
        }
        return key;
    }

    /** 공백을 없애고 소문자로. 그 밖의 표기 차이는 맞추지 않는다(다른 계정을 같은 계정으로 보지 않기 위해). */
    static String normalize(String name) {
        return name == null ? "" : name.replaceAll("\\s+", "").toLowerCase();
    }

    private static FinancialChangeRow row(FsDiv fsDiv, StatementRule rule, String key, FinancialAccount prev,
            FinancialAccount cur, ReportType prevType, ReportType curType, int order) {
        String sjDiv = rule.type().name();
        String name = cur != null ? cur.getAccountName() : prev.getAccountName();
        String currency = cur != null && cur.getCurrency() != null ? cur.getCurrency()
                : prev != null ? prev.getCurrency() : null;
        Evidence prevEvidence = evidence(prev);
        Evidence curEvidence = evidence(cur);

        if (!rule.comparable()) {
            return new FinancialChangeRow(sjDiv, fsDiv, key, name, order, null, null, null, null, null,
                    CalcStatus.PERIOD_MISMATCH, currency, prevEvidence, curEvidence);
        }
        AmountBasis basis = rule.amountBasis();
        Long prevAmount = prev == null ? null : amount(prev, rule.type(), basis, prevType);
        Long curAmount = cur == null ? null : amount(cur, rule.type(), basis, curType);

        CalcStatus status;
        Long change = null;
        BigDecimal rate = null;
        if (prev == null) {
            status = CalcStatus.ONLY_CURRENT;
        } else if (cur == null) {
            status = CalcStatus.ONLY_PREVIOUS;
        } else if (curAmount == null) {
            status = CalcStatus.CURRENT_MISSING;
        } else if (prevAmount == null) {
            status = CalcStatus.PREVIOUS_MISSING;
        } else {
            change = Math.subtractExact(curAmount, prevAmount);
            if (prevAmount == 0) {
                status = CalcStatus.PREVIOUS_ZERO;
            } else if (prevAmount < 0) {
                status = CalcStatus.PREVIOUS_NEGATIVE;
            } else {
                status = CalcStatus.OK;
                rate = BigDecimal.valueOf(change).divide(BigDecimal.valueOf(prevAmount), RATE_SCALE,
                        RoundingMode.HALF_UP);
            }
        }
        return new FinancialChangeRow(sjDiv, fsDiv, key, name, order, basis, prevAmount, curAmount, change, rate,
                status, currency, prevEvidence, curEvidence);
    }

    /**
     * 금액 기준에 맞는 값.
     * <ul>
     *   <li>시점(재무상태표)·3개월(분·반기 손익): 당기 금액(thstrm_amount)</li>
     *   <li>누적: 사업보고서는 당기 금액, 분·반기 손익은 당기 누적 금액(thstrm_add_amount, 1분기는 없으면 당기 금액),
     *       현금흐름·자본변동은 당기 금액(분·반기에도 누적으로 공시됨)</li>
     * </ul>
     */
    static Long amount(FinancialAccount account, StatementType type, AmountBasis basis, ReportType reportType) {
        if (basis != AmountBasis.CUMULATIVE || reportType == ReportType.ANNUAL) {
            return account.getThstrmAmount();
        }
        if (type == StatementType.IS || type == StatementType.CIS) {
            if (reportType == ReportType.Q1) {
                return account.getThstrmAddAmount() != null ? account.getThstrmAddAmount() : account.getThstrmAmount();
            }
            return account.getThstrmAddAmount();
        }
        return account.getThstrmAmount();
    }

    private static Evidence evidence(FinancialAccount account) {
        if (account == null) {
            return null;
        }
        return new Evidence(account.getRceptNo(), account.getSjDiv(), account.getAccountId(),
                account.getAccountName(), account.getThstrmName());
    }
}
