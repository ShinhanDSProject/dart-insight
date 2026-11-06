package com.dartinsight.textevent.domain;

import com.dartinsight.analysis.domain.FinancialChange;
import com.dartinsight.textevent.domain.TextEventRow.FactAccount;
import java.util.List;
import java.util.Objects;

/**
 * 사건의 사실 칸(ADR-0060). 기준표의 계정 이름과 공백을 뺀 이름이 같은 같은 분석의 재무상태표 계정을 찾고, 값은 다시 계산하지 않는다.
 * 계정 코드는 추측하지 않으므로 이름으로만 찾는다.
 */
public final class TextEventFacts {

    private static final String BALANCE_SHEET = "BS";

    private TextEventFacts() {
    }

    /** @param accountType 투자 유형 이름. 유형으로 나누지 않은 종류는 null */
    public record Fact(String accountType, FinancialChange change) {
    }

    /** 계정 순서대로. 찾지 못한 계정은 빠지고, 같은 이름이 여럿이면 표의 앞 계정이다 */
    public static List<Fact> match(List<FactAccount> accounts, List<FinancialChange> changes) {
        return accounts.stream().map(account -> changes.stream()
                .filter(change -> BALANCE_SHEET.equals(change.getSjDiv())
                        && compact(change.getAccountName()).equals(compact(account.accountName())))
                .findFirst().map(change -> new Fact(account.accountType(), change)).orElse(null))
                .filter(Objects::nonNull)
                .toList();
    }

    private static String compact(String name) {
        return name == null ? "" : name.replaceAll("\\s+", "");
    }
}
