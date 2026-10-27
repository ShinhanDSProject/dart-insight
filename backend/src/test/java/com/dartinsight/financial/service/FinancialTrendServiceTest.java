package com.dartinsight.financial.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.dartinsight.dart.dto.KeyAccountResponse;
import com.dartinsight.financial.domain.KeyAccount;
import com.dartinsight.financial.domain.KeyAccountRow;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** 주요계정 고르기와 화면 금액 기준(누적·3개월). 기대값은 삼성전자 실제 응답(접수번호 아래)의 모양을 따랐다. */
class FinancialTrendServiceTest {

    private static KeyAccountResponse.Item item(String fsDiv, String sjDiv, String name, String ord, String amount,
            String add) {
        return new KeyAccountResponse.Item("20260814003699", "2026", "11012", name, fsDiv, sjDiv, amount, add, ord,
                "KRW");
    }

    @Test
    @DisplayName("계정명은 공백과 끝의 (손실)을 빼고 맞추며, 정해 두지 않은 계정은 고르지 않는다")
    void matchesAccountNames() {
        assertThat(KeyAccount.fromAccountName("영업이익(손실)")).contains(KeyAccount.OPERATING_INCOME);
        assertThat(KeyAccount.fromAccountName("당기순이익(손실)")).contains(KeyAccount.NET_INCOME);
        assertThat(KeyAccount.fromAccountName("법인세차감전 순이익")).contains(KeyAccount.PROFIT_BEFORE_TAX);
        assertThat(KeyAccount.fromAccountName("법인세차감전순이익")).contains(KeyAccount.PROFIT_BEFORE_TAX);
        assertThat(KeyAccount.fromAccountName("이자수익")).isEmpty();
        assertThat(KeyAccount.fromAccountName(null)).isEmpty();
    }

    @Test
    @DisplayName("같은 기준·계정이 두 줄이면 ord가 앞선 줄을 쓰고, 금액의 쉼표를 빼며 '-'는 null이다")
    void choosesFirstRowByOrd() {
        // 삼성전자 2026 반기(20260814003699)는 당기순이익(손실)이 ord 29와 61에 두 번 온다
        List<KeyAccountRow> rows = FinancialTrendService.toRows("20260814000001", List.of(
                item("CFS", "IS", "당기순이익(손실)", "61", "1", "1"),
                item("CFS", "IS", "당기순이익(손실)", "29", "71,624,461,000,000", "118,849,733,000,000"),
                item("CFS", "IS", "영업이익", "25", "0", "-"),
                item("XXX", "IS", "매출액", "23", "1", "1"),
                item("CFS", "BS", "예수부채", "31", "1", null)));

        assertThat(rows).hasSize(2);
        KeyAccountRow net = rows.stream().filter(r -> r.account() == KeyAccount.NET_INCOME).findFirst().orElseThrow();
        assertThat(net.ord()).isEqualTo(29);
        assertThat(net.amount()).isEqualTo(71_624_461_000_000L);
        assertThat(net.cumulativeAmount()).isEqualTo(118_849_733_000_000L);
        assertThat(net.rceptNo()).isEqualTo("20260814000001");
        KeyAccountRow operating = rows.stream().filter(r -> r.account() == KeyAccount.OPERATING_INCOME)
                .findFirst().orElseThrow();
        assertThat(operating.amount()).isZero();
        assertThat(operating.cumulativeAmount()).isNull();
    }
}
