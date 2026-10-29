package com.dartinsight.checkpoint.domain;

import com.dartinsight.financial.domain.FinancialAccount;
import com.dartinsight.financial.domain.FsDiv;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/** 사업보고서 한 해에서 찾은 체크 포인트 계정. 찾지 못한 계정은 들어 있지 않다. */
public record YearAccounts(Map<CheckpointAccount, AccountValue> values) {

    public static YearAccounts empty() {
        return new YearAccounts(Map.of());
    }

    public static YearAccounts of(List<FinancialAccount> accounts, FsDiv fsDiv) {
        Map<CheckpointAccount, AccountValue> values = new EnumMap<>(CheckpointAccount.class);
        for (CheckpointAccount account : CheckpointAccount.values()) {
            account.find(accounts).ifPresent(found -> values.put(account, AccountValue.of(found, fsDiv)));
        }
        return new YearAccounts(Map.copyOf(values));
    }

    /** 찾지 못했으면 null */
    public AccountValue value(CheckpointAccount account) {
        return values.get(account);
    }

    /** 찾지 못했거나 금액이 없으면 null */
    public Long amount(CheckpointAccount account) {
        AccountValue value = values.get(account);
        return value == null ? null : value.amount();
    }

    /** 이 해에 금액이 있는지 */
    public boolean has(CheckpointAccount account) {
        return amount(account) != null;
    }

    /** 보고서 통화(찾은 계정 중 첫 통화). 없으면 null */
    public String currency() {
        return values.values().stream().map(AccountValue::currency).filter(c -> c != null).findFirst().orElse(null);
    }
}
