package com.dartinsight.analysis;

import com.dartinsight.analysis.FinancialChangeRow.Evidence;
import com.dartinsight.comparison.AmountBasis;
import com.dartinsight.comparison.StatementRules.StatementRule;
import com.dartinsight.financial.domain.FinancialAccount;
import com.dartinsight.financial.domain.FsDiv;
import com.dartinsight.financial.domain.StatementType;
import com.dartinsight.report.ReportType;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;

/**
 * 두 보고서의 재무제표 계정 값을 맞춰 증감액·증감률을 계산한다(2.4). 계산은 코드가 하고 LLM을 쓰지 않는다.
 *
 * <ul>
 *   <li>계정 대응: 표준계정코드(account_id)가 같으면 같은 계정이다. 표준계정이 아니면 정규화한 계정명으로 맞춘다.
 *       자본변동표는 계정 상세(account_detail)까지 같아야 한다. 같은 키가 여러 번 나오는 경우는 {@link #match}를 본다.</li>
 *   <li>이전 값: 이전 보고서의 원래 값(잠정안, 결정 로그 '이전 값 기준').</li>
 *   <li>금액 기준: 비교 규칙(StatementRules)이 정한 시점·누적·3개월 금액.</li>
 *   <li>증감액 = 현재 값 − 이전 값. 증감률 = 증감액 ÷ 이전 값(이전 값이 양수일 때만, 소수 6자리 반올림).</li>
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
            List<Pair> pairs = match(accountsOf(previous, sjDiv), accountsOf(current, sjDiv), rule.type());
            int order = 0;
            for (Pair pair : pairs) {
                rows.add(row(fsDiv, rule, pair, previous.reportType(), current.reportType(), order++));
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

    /**
     * 짝지은 계정. 같은 계정이 여러 개라 짝을 확정하지 못하면 ambiguous이고, 한쪽 값만 둔다.
     */
    record Pair(String key, FinancialAccount previous, FinancialAccount current, boolean ambiguous) {
    }

    /**
     * 두 보고서의 계정을 짝짓는다.
     * <ol>
     *   <li>계정 키가 한 재무제표 안에서 여러 번 나오면, 그 키에는 정규화한 계정명을 더해 구분한다
     *       (자본변동표의 기초자본·기말자본처럼 계정 ID와 상세가 같은 경우).</li>
     *   <li>그래도 같은 키가 여러 개면, 두 보고서의 개수가 같을 때만 원문 순서대로 짝짓는다.
     *       개수가 다르면 어느 것이 같은 계정인지 확정할 수 없어 짝짓지 않고 AMBIGUOUS_MATCH로 둔다.</li>
     *   <li>순서: 현재 보고서의 원문 순서, 이전 보고서에만 있는 계정은 그 뒤에 이전 보고서 순서로.</li>
     * </ol>
     */
    static List<Pair> match(List<FinancialAccount> previous, List<FinancialAccount> current, StatementType type) {
        Set<String> repeated = new HashSet<>();
        repeated.addAll(repeatedBases(previous, type));
        repeated.addAll(repeatedBases(current, type));
        Function<FinancialAccount, String> key = account -> {
            String base = accountKey(account, type);
            return repeated.contains(base) ? base + "|" + normalize(account.getAccountName()) : base;
        };
        Map<String, List<FinancialAccount>> prevGroups = group(previous, key);
        Map<String, List<FinancialAccount>> curGroups = group(current, key);

        List<Pair> pairs = new ArrayList<>();
        Map<String, Integer> seen = new HashMap<>();
        for (FinancialAccount account : current) {
            String k = key.apply(account);
            int i = seen.merge(k, 1, Integer::sum) - 1;
            String rowKey = i == 0 ? k : k + "#" + (i + 1);
            List<FinancialAccount> sameKeyPrev = prevGroups.getOrDefault(k, List.of());
            if (sameKeyPrev.isEmpty()) {
                pairs.add(new Pair(rowKey, null, account, false));
            } else if (sameKeyPrev.size() == curGroups.get(k).size()) {
                pairs.add(new Pair(rowKey, sameKeyPrev.get(i), account, false));
            } else {
                pairs.add(new Pair(rowKey, null, account, true));
            }
        }
        seen.clear();
        for (FinancialAccount account : previous) {
            String k = key.apply(account);
            int i = seen.merge(k, 1, Integer::sum) - 1;
            List<FinancialAccount> sameKeyCur = curGroups.getOrDefault(k, List.of());
            if (sameKeyCur.isEmpty()) {
                pairs.add(new Pair(i == 0 ? k : k + "#" + (i + 1), account, null, false));
            } else if (sameKeyCur.size() != prevGroups.get(k).size()) {
                pairs.add(new Pair(k + "#prev" + (i + 1), account, null, true));
            }
        }
        return pairs;
    }

    private static Set<String> repeatedBases(List<FinancialAccount> accounts, StatementType type) {
        Map<String, Integer> counts = new HashMap<>();
        accounts.forEach(a -> counts.merge(accountKey(a, type), 1, Integer::sum));
        Set<String> repeated = new HashSet<>();
        counts.forEach((k, n) -> {
            if (n > 1) {
                repeated.add(k);
            }
        });
        return repeated;
    }

    private static Map<String, List<FinancialAccount>> group(List<FinancialAccount> accounts,
            Function<FinancialAccount, String> key) {
        Map<String, List<FinancialAccount>> groups = new LinkedHashMap<>();
        accounts.forEach(a -> groups.computeIfAbsent(key.apply(a), k -> new ArrayList<>()).add(a));
        return groups;
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
        return name == null ? "" : name.replaceAll("\\s+", "").toLowerCase(Locale.ROOT);
    }

    private static FinancialChangeRow row(FsDiv fsDiv, StatementRule rule, Pair pair, ReportType prevType,
            ReportType curType, int order) {
        String sjDiv = rule.type().name();
        String key = pair.key();
        FinancialAccount prev = pair.previous();
        FinancialAccount cur = pair.current();
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
        if (pair.ambiguous()) {
            status = CalcStatus.AMBIGUOUS_MATCH;
        } else if (prev == null) {
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
