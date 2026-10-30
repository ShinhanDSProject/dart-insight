package com.dartinsight.checkpoint.domain;

import static com.dartinsight.checkpoint.domain.CheckpointAccount.CURRENT_PORTION_OF_LONG_TERM_BORROWINGS;
import static com.dartinsight.checkpoint.domain.CheckpointAccount.INVENTORIES;
import static com.dartinsight.checkpoint.domain.CheckpointAccount.OPERATING_CASH_FLOW;
import static com.dartinsight.checkpoint.domain.CheckpointAccount.OPERATING_INCOME;
import static com.dartinsight.checkpoint.domain.CheckpointAccount.REVENUE;
import static com.dartinsight.checkpoint.domain.CheckpointAccount.SHORT_TERM_BORROWINGS;
import static com.dartinsight.checkpoint.domain.CheckpointAccount.TOTAL_EQUITY;
import static com.dartinsight.checkpoint.domain.CheckpointAccount.TOTAL_LIABILITIES;
import static com.dartinsight.checkpoint.domain.CheckpointAccount.TRADE_RECEIVABLES;

import com.dartinsight.checkpoint.domain.CheckpointFact.Reason;
import com.dartinsight.checkpoint.domain.CheckpointFact.Quote;
import com.dartinsight.disclosure.domain.Disclosure;
import com.dartinsight.disclosure.domain.GoingConcernFinding;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 재무 체크 포인트 규칙(FS-62, docs/api-spec.md GET /api/companies/{corpCode}/checkpoints의 '항목과 규칙' 표). LLM을 쓰지
 * 않고 숫자는 모두 여기서 계산한다. 규칙에 필요한 값이 없거나 계산할 수 없으면 NO_DATA다(0과 구분).
 * 기준값은 판단 기준이라 ADR이 아니라 이 상수와 api-spec에 둔다. 바꾸면 두 곳을 함께 고친다.
 */
public final class CheckpointRules {

    /** 매출채권 증가율 − 매출 증가율(%p) */
    public static final int RECEIVABLES_GAP = 10;
    /** 재고자산 증가율 − 매출 증가율(%p) */
    public static final int INVENTORIES_GAP = 10;
    /** 올해 부채비율 − 작년 부채비율(%p) */
    public static final int DEBT_RATIO_CHANGE = 20;
    /** 단기 차입금 증가율 − 매출 증가율(%p) */
    public static final int BORROWINGS_GAP = 20;
    /** 최근 1년 자금 조달 묶음 공시 건수 */
    public static final int FUNDING_COUNT = 1;
    /**
     * 자금 조달 공시 가운데 발행 주식 수가 늘어날 수 있는(희석) 조달로 세는 제목 낱말. 회사채·기업어음 같은 채무증권만의
     * 공시는 세지 않는다. 낱말은 에코프로비엠 2026 공시 목록 제목(유상증자결정·전환사채·증권신고서(지분증권) 등)으로 확인
     */
    public static final List<String> EQUITY_WORDS = List.of("유상증자", "전환사채", "신주인수권", "교환사채", "주식관련사채",
            "지분증권", "전환가액");
    /** 최근 1년 적정이 아닌 감사의견 건수 */
    public static final int AUDIT_COUNT = 1;

    /** 감사의견 항목의 계속기업 사실 줄 이름(#546) */
    public static final String GOING_CONCERN_LABEL = "계속기업 관련 강조사항";

    static final String CURRENT = "올해";
    static final String PREVIOUS = "작년";

    private CheckpointRules() {
    }

    /** 일곱 항목을 정해 둔 순서로 */
    public static List<CheckpointItem> all(YearAccounts current, YearAccounts previous,
            Optional<List<Disclosure>> funding, Optional<AuditFindings> audits, Integer auditorChanges) {
        return List.of(
                earningsQuality(current, previous),
                receivables(current, previous),
                inventories(current, previous),
                debtRatio(current, previous),
                shortTermBorrowings(current, previous),
                funding(funding),
                audit(audits, auditorChanges));
    }

    /**
     * 이익과 현금흐름. 올해 영업이익 &gt; 0이고 영업활동현금흐름 &lt; 0이거나, 영업이익이 늘었는데 영업활동현금흐름이 줄었으면
     * CHECK. 올해 두 값이 없으면 NO_DATA. 작년 값이 없으면 앞 조건만 본다.
     */
    public static CheckpointItem earningsQuality(YearAccounts current, YearAccounts previous) {
        List<CheckpointFact> facts = List.of(
                CheckpointFact.amount(label(OPERATING_INCOME, CURRENT), current.value(OPERATING_INCOME)),
                CheckpointFact.amount(label(OPERATING_INCOME, PREVIOUS), previous.value(OPERATING_INCOME)),
                CheckpointFact.amount(label(OPERATING_CASH_FLOW, CURRENT), current.value(OPERATING_CASH_FLOW)),
                CheckpointFact.amount(label(OPERATING_CASH_FLOW, PREVIOUS), previous.value(OPERATING_CASH_FLOW)));
        Long income = current.amount(OPERATING_INCOME);
        Long cash = current.amount(OPERATING_CASH_FLOW);
        if (income == null || cash == null) {
            return CheckpointItem.of(CheckpointKey.EARNINGS_QUALITY, CheckpointStatus.NO_DATA,
                    missingNote(CURRENT, income == null ? OPERATING_INCOME : OPERATING_CASH_FLOW), facts);
        }
        if (income > 0 && cash < 0) {
            return CheckpointItem.of(CheckpointKey.EARNINGS_QUALITY, CheckpointStatus.CHECK,
                    "올해 영업이익은 0보다 크고 영업활동현금흐름은 0보다 작아요.", facts);
        }
        Long previousIncome = previous.amount(OPERATING_INCOME);
        Long previousCash = previous.amount(OPERATING_CASH_FLOW);
        if (previousIncome != null && previousCash != null && income > previousIncome && cash < previousCash) {
            return CheckpointItem.of(CheckpointKey.EARNINGS_QUALITY, CheckpointStatus.CHECK,
                    "작년보다 영업이익은 늘고 영업활동현금흐름은 줄었어요.", facts);
        }
        String note = previousIncome == null || previousCash == null
                ? "작년 값을 찾지 못해 작년 대비 방향은 보지 않았어요." : null;
        return CheckpointItem.of(CheckpointKey.EARNINGS_QUALITY, CheckpointStatus.OK, note, facts);
    }

    /** 매출채권 증가율 − 매출 증가율 ≥ {@link #RECEIVABLES_GAP}%p면 CHECK */
    public static CheckpointItem receivables(YearAccounts current, YearAccounts previous) {
        return growthGap(CheckpointKey.RECEIVABLES, TRADE_RECEIVABLES, RECEIVABLES_GAP, current, previous);
    }

    /** 재고자산 증가율 − 매출 증가율 ≥ {@link #INVENTORIES_GAP}%p면 CHECK */
    public static CheckpointItem inventories(YearAccounts current, YearAccounts previous) {
        return growthGap(CheckpointKey.INVENTORIES, INVENTORIES, INVENTORIES_GAP, current, previous);
    }

    private static CheckpointItem growthGap(CheckpointKey key, CheckpointAccount target, int threshold,
            YearAccounts current, YearAccounts previous) {
        Rate revenueGrowth = Rate.growth(previous.amount(REVENUE), current.amount(REVENUE));
        Rate targetGrowth = Rate.growth(previous.amount(target), current.amount(target));
        Rate gap = targetGrowth.minus(revenueGrowth);
        List<CheckpointFact> facts = List.of(
                CheckpointFact.amount(label(REVENUE, CURRENT), current.value(REVENUE)),
                CheckpointFact.amount(label(REVENUE, PREVIOUS), previous.value(REVENUE)),
                CheckpointFact.amount(label(target, CURRENT), current.value(target)),
                CheckpointFact.amount(label(target, PREVIOUS), previous.value(target)),
                CheckpointFact.rate(REVENUE.label() + " 증가율", revenueGrowth),
                CheckpointFact.rate(target.label() + " 증가율", targetGrowth),
                CheckpointFact.points("증가율 차이", gap));
        if (!gap.present()) {
            String note = !targetGrowth.present() ? growthNote(target, targetGrowth, current, previous)
                    : growthNote(REVENUE, revenueGrowth, current, previous);
            return CheckpointItem.of(key, CheckpointStatus.NO_DATA, note, facts);
        }
        return CheckpointItem.of(key, gap.atLeast(threshold) ? CheckpointStatus.CHECK : CheckpointStatus.OK, null,
                facts);
    }

    /**
     * 부채비율. 올해 자본총계 ≤ 0이면 자본잠식으로 CHECK(부채비율은 계산하지 않음). 올해 − 작년 부채비율 ≥
     * {@link #DEBT_RATIO_CHANGE}%p면 CHECK. 작년 부채비율을 계산할 수 없으면 NO_DATA.
     */
    public static CheckpointItem debtRatio(YearAccounts current, YearAccounts previous) {
        Rate currentRatio = Rate.ratio(current.amount(TOTAL_LIABILITIES), current.amount(TOTAL_EQUITY));
        Rate previousRatio = Rate.ratio(previous.amount(TOTAL_LIABILITIES), previous.amount(TOTAL_EQUITY));
        Rate change = currentRatio.minus(previousRatio);
        List<CheckpointFact> facts = List.of(
                CheckpointFact.amount(label(TOTAL_LIABILITIES, CURRENT), current.value(TOTAL_LIABILITIES)),
                CheckpointFact.amount(label(TOTAL_LIABILITIES, PREVIOUS), previous.value(TOTAL_LIABILITIES)),
                CheckpointFact.amount(label(TOTAL_EQUITY, CURRENT), current.value(TOTAL_EQUITY)),
                CheckpointFact.amount(label(TOTAL_EQUITY, PREVIOUS), previous.value(TOTAL_EQUITY)),
                CheckpointFact.rate("부채비율 (" + CURRENT + ")", currentRatio),
                CheckpointFact.rate("부채비율 (" + PREVIOUS + ")", previousRatio),
                CheckpointFact.points("부채비율 변화", change));
        Long equity = current.amount(TOTAL_EQUITY);
        if (equity != null && equity <= 0) {
            return CheckpointItem.of(CheckpointKey.DEBT_RATIO, CheckpointStatus.CHECK,
                    "올해 자본총계가 0 이하예요(자본잠식). 부채비율은 계산하지 않았어요.", facts);
        }
        if (!currentRatio.present()) {
            return CheckpointItem.of(CheckpointKey.DEBT_RATIO, CheckpointStatus.NO_DATA,
                    missingNote(CURRENT, current.has(TOTAL_LIABILITIES) ? TOTAL_EQUITY : TOTAL_LIABILITIES), facts);
        }
        if (!previousRatio.present()) {
            String note = previousRatio.reason() == Reason.EQUITY_NOT_POSITIVE
                    ? "작년 자본총계가 0 이하라 작년 부채비율과 변화를 계산하지 않았어요."
                    : missingNote(PREVIOUS, previous.has(TOTAL_LIABILITIES) ? TOTAL_EQUITY : TOTAL_LIABILITIES);
            return CheckpointItem.of(CheckpointKey.DEBT_RATIO, CheckpointStatus.NO_DATA, note, facts);
        }
        return CheckpointItem.of(CheckpointKey.DEBT_RATIO,
                change.atLeast(DEBT_RATIO_CHANGE) ? CheckpointStatus.CHECK : CheckpointStatus.OK, null, facts);
    }

    /**
     * 단기 차입금 = 단기차입금 + 유동성장기부채 가운데 두 해 모두 금액을 찾은 계정의 합. 단기 차입금 증가율 − 매출 증가율 ≥
     * {@link #BORROWINGS_GAP}%p면 CHECK. 두 해 모두 찾은 계정이 없으면 NO_DATA.
     */
    public static CheckpointItem shortTermBorrowings(YearAccounts current, YearAccounts previous) {
        List<CheckpointAccount> parts = List.of(SHORT_TERM_BORROWINGS, CURRENT_PORTION_OF_LONG_TERM_BORROWINGS);
        List<CheckpointAccount> used = parts.stream().filter(p -> current.has(p) && previous.has(p)).toList();
        List<CheckpointAccount> oneYearOnly = parts.stream()
                .filter(p -> !used.contains(p) && (current.has(p) || previous.has(p))).toList();
        List<CheckpointFact> facts = new ArrayList<>();
        for (CheckpointAccount part : parts) {
            facts.add(CheckpointFact.amount(label(part, CURRENT), current.value(part)));
            facts.add(CheckpointFact.amount(label(part, PREVIOUS), previous.value(part)));
        }
        Long currentSum = used.isEmpty() ? null : used.stream().mapToLong(current::amount).reduce(0, Math::addExact);
        Long previousSum = used.isEmpty() ? null : used.stream().mapToLong(previous::amount).reduce(0, Math::addExact);
        String currency = current.currency();
        Rate revenueGrowth = Rate.growth(previous.amount(REVENUE), current.amount(REVENUE));
        Rate borrowingGrowth = Rate.growth(previousSum, currentSum);
        Rate gap = borrowingGrowth.minus(revenueGrowth);
        facts.add(CheckpointFact.sum("단기 차입금 합계 (" + CURRENT + ")", currentSum, currency));
        facts.add(CheckpointFact.sum("단기 차입금 합계 (" + PREVIOUS + ")", previousSum, currency));
        facts.add(CheckpointFact.amount(label(REVENUE, CURRENT), current.value(REVENUE)));
        facts.add(CheckpointFact.amount(label(REVENUE, PREVIOUS), previous.value(REVENUE)));
        facts.add(CheckpointFact.rate(REVENUE.label() + " 증가율", revenueGrowth));
        facts.add(CheckpointFact.rate("단기 차입금 증가율", borrowingGrowth));
        facts.add(CheckpointFact.points("증가율 차이", gap));

        String partsNote = oneYearOnly.isEmpty() ? null
                : names(oneYearOnly) + " 값은 한 해에만 있어 더하지 않았어요.";
        if (used.isEmpty()) {
            return CheckpointItem.of(CheckpointKey.SHORT_TERM_BORROWINGS, CheckpointStatus.NO_DATA,
                    "단기차입금·유동성장기부채 값을 두 해 모두 찾지 못했어요.", facts);
        }
        if (!gap.present()) {
            String note = !borrowingGrowth.present()
                    ? growthReasonNote("단기 차입금 합계", borrowingGrowth.reason())
                    : growthNote(REVENUE, revenueGrowth, current, previous);
            return CheckpointItem.of(CheckpointKey.SHORT_TERM_BORROWINGS, CheckpointStatus.NO_DATA, join(note, partsNote),
                    facts);
        }
        return CheckpointItem.of(CheckpointKey.SHORT_TERM_BORROWINGS,
                gap.atLeast(BORROWINGS_GAP) ? CheckpointStatus.CHECK : CheckpointStatus.OK, partsNote, facts);
    }

    /**
     * 자금 조달 공시. 최근 1년 '자금 조달' 묶음 공시가 {@link #FUNDING_COUNT}건 이상이면 CHECK.
     *
     * @param disclosures 공시 목록을 받지 못했으면 빈 값
     */
    public static CheckpointItem funding(Optional<List<Disclosure>> disclosures) {
        if (disclosures.isEmpty()) {
            return CheckpointItem.of(CheckpointKey.FUNDING_DISCLOSURES, CheckpointStatus.NO_DATA,
                    "공시 목록을 받지 못해 세지 못했어요.", List.of(CheckpointFact.count("자금 조달 공시", null)));
        }
        List<Disclosure> found = disclosures.get().stream().filter(CheckpointRules::isEquityFunding).toList();
        boolean check = found.size() >= FUNDING_COUNT;
        String note = check ? "공시마다 조달 방식(주식·사채)과 조건이 달라요. 발행 주식 수가 늘어날 수 있는지는 각 공시 원문에 있어요."
                : null;
        return new CheckpointItem(CheckpointKey.FUNDING_DISCLOSURES,
                check ? CheckpointStatus.CHECK : CheckpointStatus.OK, note,
                List.of(CheckpointFact.count("자금 조달 공시", found.size())), List.copyOf(found));
    }

    /** 제목(공백 무시)에 주식 관련 낱말이 있는 자금 조달 공시인지 */
    static boolean isEquityFunding(Disclosure disclosure) {
        String title = disclosure.reportName() == null ? "" : disclosure.reportName().replace(" ", "");
        return EQUITY_WORDS.stream().anyMatch(title::contains);
    }

    /**
     * 감사의견. 확인해 볼 공시의 '감사의견(적정이 아님)'이 {@link #AUDIT_COUNT}건 이상이거나, 당기 강조사항 등·감사보고서
     * 특기사항에 '계속기업'이 있으면(#546) CHECK. 감사인 변경 건수는 참고 수치다.
     *
     * @param findings       확인해 볼 공시의 감사의견 결과. 확인하지 못했으면 빈 값
     * @param auditorChanges 감사인 변경 건수. 확인하지 못했으면 null
     */
    public static CheckpointItem audit(Optional<AuditFindings> findings, Integer auditorChanges) {
        String reference = "감사인 변경 건수는 참고로만 보여 줘요.";
        if (findings.isEmpty()) {
            return CheckpointItem.of(CheckpointKey.AUDIT_OPINION, CheckpointStatus.NO_DATA,
                    "사업보고서 감사의견을 받지 못해 확인하지 못했어요.", List.of(
                            CheckpointFact.count("적정이 아닌 감사의견", null),
                            CheckpointFact.presence(GOING_CONCERN_LABEL, null, null),
                            CheckpointFact.count("감사인 변경 (참고)", auditorChanges)));
        }
        List<Disclosure> nonClean = findings.get().nonClean();
        Optional<GoingConcernFinding> goingConcern = findings.get().goingConcern().stream().findFirst();
        boolean check = nonClean.size() >= AUDIT_COUNT || goingConcern.isPresent();
        String note = goingConcern
                .map(f -> "사업보고서에 적힌 " + f.note().term() + " " + f.note().field() + "에 '계속기업' 문구가 있어요. "
                        + reference)
                .orElse(reference);
        Quote quote = goingConcern.map(f -> new Quote(f.note().excerpt(), f.rceptNo())).orElse(null);
        return new CheckpointItem(CheckpointKey.AUDIT_OPINION, check ? CheckpointStatus.CHECK : CheckpointStatus.OK,
                note,
                List.of(CheckpointFact.count("적정이 아닌 감사의견", nonClean.size()),
                        CheckpointFact.presence(GOING_CONCERN_LABEL, goingConcern.isPresent(), quote),
                        CheckpointFact.count("감사인 변경 (참고)", auditorChanges)),
                auditDisclosures(nonClean, findings.get().goingConcern()));
    }

    /** 적정이 아닌 의견이나 계속기업 문구가 있는 사업보고서. 같은 보고서는 한 번, 접수일이 최근인 순서 */
    private static List<Disclosure> auditDisclosures(List<Disclosure> nonClean, List<GoingConcernFinding> goingConcern) {
        Map<String, Disclosure> byRceptNo = new LinkedHashMap<>();
        nonClean.forEach(d -> byRceptNo.putIfAbsent(d.rceptNo(), d));
        goingConcern.forEach(f -> byRceptNo.putIfAbsent(f.disclosure().rceptNo(), f.disclosure()));
        return byRceptNo.values().stream()
                .sorted(Comparator.comparing(Disclosure::rceptDt).thenComparing(Disclosure::rceptNo)
                        .reversed())
                .toList();
    }

    static String label(CheckpointAccount account, String year) {
        return account.label() + " (" + year + ")";
    }

    private static String missingNote(String year, CheckpointAccount account) {
        return year + " " + account.label() + " 값을 찾지 못했어요.";
    }

    /** 증가율을 계산하지 못한 이유 문장 */
    private static String growthNote(CheckpointAccount account, Rate growth, YearAccounts current,
            YearAccounts previous) {
        if (growth.reason() == Reason.MISSING) {
            return missingNote(current.has(account) ? PREVIOUS : CURRENT, account);
        }
        return growthReasonNote(account.label(), growth.reason());
    }

    private static String growthReasonNote(String name, Reason reason) {
        return switch (reason) {
            case PREVIOUS_ZERO -> "작년 " + name + " 값이 0이라 증가율을 계산하지 않았어요.";
            case PREVIOUS_NEGATIVE -> "작년 " + name + " 값이 음수라 증가율을 계산하지 않았어요.";
            default -> name + " 값을 두 해 모두 찾지 못했어요.";
        };
    }

    private static String names(List<CheckpointAccount> accounts) {
        return String.join("·", accounts.stream().map(CheckpointAccount::label).toList());
    }

    private static String join(String first, String second) {
        return second == null ? first : first + " " + second;
    }
}
