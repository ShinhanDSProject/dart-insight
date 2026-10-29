package com.dartinsight.checkpoint.domain;

import com.dartinsight.checkpoint.domain.CheckpointFact.Evidence;
import com.dartinsight.financial.domain.FinancialAccount;
import com.dartinsight.financial.domain.FsDiv;
import com.dartinsight.financial.domain.StatementType;

/**
 * 사업보고서 한 해의 계정 값. 금액은 당기 금액(thstrm_amount)이다: 재무상태표는 기말 잔액, 손익·현금흐름은 1년.
 *
 * @param amount 없으면 null(빈 값·'-'). 0과 구분한다
 */
public record AccountValue(Long amount, String currency, Evidence evidence) {

    public static AccountValue of(FinancialAccount account, FsDiv fsDiv) {
        String statementName = StatementType.of(account.getSjDiv()).map(StatementType::label)
                .orElse(account.getSjName());
        return new AccountValue(account.getThstrmAmount(), account.getCurrency(), new Evidence(account.getRceptNo(),
                fsDiv, account.getSjDiv(), statementName, account.getAccountId(), account.getAccountName()));
    }
}
