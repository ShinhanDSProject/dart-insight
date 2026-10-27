package com.dartinsight.analysis.service;

import com.dartinsight.analysis.domain.CalcStatus;
import com.dartinsight.analysis.domain.FinancialChangeRow.Evidence;
import com.dartinsight.analysis.domain.FinancialChangeRow;
import com.dartinsight.comparison.domain.AmountBasis;
import com.dartinsight.comparison.service.StatementRules.StatementRule;
import com.dartinsight.financial.domain.FinancialAccount;
import com.dartinsight.financial.domain.FsDiv;
import com.dartinsight.financial.domain.StatementType;
import com.dartinsight.report.domain.ReportType;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.IdentityHashMap;
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
 *       자본변동표는 계정 상세(account_detail)까지 같아야 한다. 같은 키가 여러 번 나오는 경우는 {@link #match}를 본다.
 *       회사가 해마다 다른 계정 ID를 써서 키로 짝짓지 못한 계정은 이름으로 한 번 더 맞춘다({@link #pairByName}).</li>
 *   <li>이전 값: 이전 보고서의 원래 값(잠정안, 결정 로그 '이전 값 기준').</li>
 *   <li>금액 기준: 비교 규칙(StatementRules)이 정한 시점·누적·3개월 금액.</li>
 *   <li>증감액 = 현재 값 − 이전 값. 증감률 = 증감액 ÷ 이전 값(이전 값이 양수이고 현재 값이 음수가 아닐 때만,
 *       소수 6자리 반올림). 부호가 바뀌거나 이전 값이 음수면 {@link #status}가 정한 상태로 두고 증감률을 비운다.</li>
 * </ul>
 */
public final class FinancialComparator {

    static final int RATE_SCALE = 6;

    /** 계정명으로 맞춘 키의 앞머리 */
    static final String NAME_KEY_PREFIX = "NAME:";

    /**
     * 흑자·적자로 부르는 이익 계정의 표준계정 ID(#144, docs/api-spec.md 재무 수치 변화). 손익계산서(IS·CIS)에서만 쓴다.
     * 2024 사업보고서(연결) 7곳의 실제 응답으로 확인했다: SK하이닉스 20250319000665, LG디스플레이 20250312000906,
     * 카카오 20250324000901, 삼성전자 20250311001085, 신한지주 20250318000993, KB금융, 에코프로비엠 20250325000761.
     * 비지배지분 순이익·총포괄손익·주당이익은 넣지 않는다. 바꾸면 Analysis.CURRENT_VERSION을 함께 올린다.
     */
    static final Set<String> PROFIT_ACCOUNT_IDS = Set.of(
            "dart_OperatingIncomeLoss",
            "ifrs-full_ProfitLossFromOperatingActivities",
            "ifrs-full_GrossProfit",
            "ifrs-full_ProfitLossBeforeTax",
            "ifrs-full_ProfitLoss",
            "ifrs-full_ProfitLossAttributableToOwnersOfParent");

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
     *   <li>키로 짝짓지 못한 계정은 {@link #pairByName}으로 이름이 같은 계정을 한 번 더 찾는다.</li>
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
        return pairByName(pairs, type);
    }

    /**
     * 한쪽에만 있는 계정끼리 정규화한 계정명(자본변동표는 계정 상세까지)이 같으면 짝짓는다.
     * 같은 계정의 표준계정코드가 해마다 바뀌는 경우다(예: 삼성전자 유형자산 {@code ifrs-full_PropertyPlantAndEquipment}
     * → {@code ifrs-full_PropertyPlantAndEquipmentIncludingRightofuseAssets}, 단기차입금 표준계정 미사용 →
     * {@code dart_CurrentLoansReceived}). 그 이름이 남은 계정 중 양쪽에 하나씩일 때만 짝짓고, 두 계정 ID는 근거에 그대로 남는다.
     * 키는 {@code NAME:계정명}이고, 이미 쓰인 키면 짝짓지 않는다.
     */
    static List<Pair> pairByName(List<Pair> pairs, StatementType type) {
        Function<FinancialAccount, String> nameKey = account -> {
            String key = NAME_KEY_PREFIX + normalize(account.getAccountName());
            return type == StatementType.SCE && account.getAccountDetail() != null
                    ? key + "|" + normalize(account.getAccountDetail()) : key;
        };
        Map<String, List<Pair>> onlyCurrent = new HashMap<>();
        Map<String, List<Pair>> onlyPrevious = new HashMap<>();
        Set<String> usedKeys = new HashSet<>();
        for (Pair pair : pairs) {
            usedKeys.add(pair.key());
            if (pair.ambiguous()) {
                continue;
            }
            if (pair.previous() == null) {
                onlyCurrent.computeIfAbsent(nameKey.apply(pair.current()), k -> new ArrayList<>()).add(pair);
            } else if (pair.current() == null) {
                onlyPrevious.computeIfAbsent(nameKey.apply(pair.previous()), k -> new ArrayList<>()).add(pair);
            }
        }
        Map<Pair, Pair> merged = new IdentityHashMap<>();
        Set<Pair> absorbed = Collections.newSetFromMap(new IdentityHashMap<>());
        onlyCurrent.forEach((name, curPairs) -> {
            List<Pair> prevPairs = onlyPrevious.getOrDefault(name, List.of());
            if (curPairs.size() != 1 || prevPairs.size() != 1) {
                return;
            }
            Pair cur = curPairs.get(0);
            Pair prev = prevPairs.get(0);
            String key = cur.key().equals(name) || prev.key().equals(name) || !usedKeys.contains(name) ? name : null;
            if (key != null) {
                merged.put(cur, new Pair(key, prev.previous(), cur.current(), false));
                absorbed.add(prev);
            }
        });
        if (merged.isEmpty()) {
            return pairs;
        }
        List<Pair> result = new ArrayList<>();
        for (Pair pair : pairs) {
            if (!absorbed.contains(pair)) {
                result.add(merged.getOrDefault(pair, pair));
            }
        }
        return result;
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
        String key = account.isStandardAccount() ? account.getAccountId() : NAME_KEY_PREFIX + normalize(account.getAccountName());
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
        // 자본변동표는 같은 계정명이 자본 구성요소마다 있어 계정 상세로 구분해 보여 준다(#401)
        String detail = rule.type() != StatementType.SCE ? null
                : cur != null && cur.getAccountDetail() != null ? cur.getAccountDetail()
                : prev != null ? prev.getAccountDetail() : null;

        if (!rule.comparable()) {
            return new FinancialChangeRow(sjDiv, fsDiv, key, name, order, null, null, null, null, null,
                    CalcStatus.PERIOD_MISMATCH, currency, prevEvidence, curEvidence, detail);
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
            status = status(prevAmount, curAmount, profitAccount(rule.type(), cur));
            if (status == CalcStatus.OK) {
                rate = BigDecimal.valueOf(change).divide(BigDecimal.valueOf(prevAmount), RATE_SCALE,
                        RoundingMode.HALF_UP);
            }
        }
        return new FinancialChangeRow(sjDiv, fsDiv, key, name, order, basis, prevAmount, curAmount, change, rate,
                status, currency, prevEvidence, curEvidence, detail);
    }

    /**
     * 금액 기준에 맞는 값.
     * <ul>
     *   <li>시점(재무상태표)·3개월(분·반기 손익): 당기 금액(thstrm_amount)</li>
     *   <li>누적: 사업보고서는 당기 금액, 분·반기 손익은 당기 누적 금액(thstrm_add_amount, 1분기는 없으면 당기 금액),
     *       현금흐름·자본변동은 당기 금액(분·반기에도 누적으로 공시됨)</li>
     * </ul>
     */
    /**
     * 두 값이 모두 있을 때의 계산 상태(docs/erd.md financial_change.calc_status 판정표). OK일 때만 증감률을 계산한다.
     *
     * @param profit 흑자·적자로 부르는 이익 계정인지({@link #profitAccount})
     */
    static CalcStatus status(long previous, long current, boolean profit) {
        if (previous == 0) {
            return CalcStatus.PREVIOUS_ZERO;
        }
        if (previous > 0) {
            if (current >= 0) {
                return CalcStatus.OK;
            }
            return profit ? CalcStatus.TURNED_LOSS : CalcStatus.SIGN_CHANGED;
        }
        if (current > 0) {
            return profit ? CalcStatus.TURNED_PROFIT : CalcStatus.SIGN_CHANGED;
        }
        if (!profit || current == previous) {
            return CalcStatus.PREVIOUS_NEGATIVE;
        }
        return current > previous ? CalcStatus.LOSS_NARROWED : CalcStatus.LOSS_WIDENED;
    }

    /** 손익계산서에 있고 현재 보고서의 표준계정 ID가 이익 계정 목록에 있는지. 회사 고유 계정은 아니다 */
    static boolean profitAccount(StatementType type, FinancialAccount current) {
        return (type == StatementType.IS || type == StatementType.CIS)
                && PROFIT_ACCOUNT_IDS.contains(current.getAccountId());
    }

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
