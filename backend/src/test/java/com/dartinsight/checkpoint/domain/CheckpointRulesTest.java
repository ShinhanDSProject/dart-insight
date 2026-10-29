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
import static org.assertj.core.api.Assertions.assertThat;

import com.dartinsight.checkpoint.domain.CheckpointFact.Reason;
import com.dartinsight.disclosure.domain.Disclosure;
import com.dartinsight.financial.domain.FsDiv;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** 금액은 모두 가짜다. */
class CheckpointRulesTest {

    /** 계정 → 금액(null이면 계정은 있고 금액이 없음). 넣지 않은 계정은 찾지 못한 계정이다 */
    private static YearAccounts year(Object... pairs) {
        Map<CheckpointAccount, AccountValue> values = new EnumMap<>(CheckpointAccount.class);
        for (int i = 0; i < pairs.length; i += 2) {
            Long amount = pairs[i + 1] == null ? null : ((Number) pairs[i + 1]).longValue();
            values.put((CheckpointAccount) pairs[i], new AccountValue(amount, "KRW", new CheckpointFact.Evidence(
                    "20260310000001", FsDiv.CFS, "BS", "재무상태표", "id", "name")));
        }
        return new YearAccounts(values);
    }

    private static BigDecimal fact(CheckpointItem item, String label) {
        return item.facts().stream().filter(f -> f.label().equals(label)).findFirst().orElseThrow().value();
    }

    private static Reason reason(CheckpointItem item, String label) {
        return item.facts().stream().filter(f -> f.label().equals(label)).findFirst().orElseThrow().reason();
    }

    @Test
    @DisplayName("영업이익이 흑자인데 영업활동현금흐름이 음수면 확인해 볼 점이다")
    void earningsQualityChecksPositiveIncomeWithNegativeCash() {
        CheckpointItem item = CheckpointRules.earningsQuality(year(OPERATING_INCOME, 10, OPERATING_CASH_FLOW, -1),
                year());
        assertThat(item.status()).isEqualTo(CheckpointStatus.CHECK);
        assertThat(item.note()).contains("0보다 작아요");
    }

    @Test
    @DisplayName("영업이익이 늘었는데 영업활동현금흐름이 줄었으면 확인해 볼 점이고, 같으면 특이사항 없음이다")
    void earningsQualityChecksDivergingDirections() {
        YearAccounts previous = year(OPERATING_INCOME, 10, OPERATING_CASH_FLOW, 20);
        assertThat(CheckpointRules.earningsQuality(year(OPERATING_INCOME, 11, OPERATING_CASH_FLOW, 19), previous)
                .status()).isEqualTo(CheckpointStatus.CHECK);
        assertThat(CheckpointRules.earningsQuality(year(OPERATING_INCOME, 10, OPERATING_CASH_FLOW, 19), previous)
                .status()).isEqualTo(CheckpointStatus.OK);
        assertThat(CheckpointRules.earningsQuality(year(OPERATING_INCOME, 11, OPERATING_CASH_FLOW, 20), previous)
                .status()).isEqualTo(CheckpointStatus.OK);
        // 영업이익 0은 흑자가 아니다
        assertThat(CheckpointRules.earningsQuality(year(OPERATING_INCOME, 0, OPERATING_CASH_FLOW, -5), year())
                .status()).isEqualTo(CheckpointStatus.OK);
    }

    @Test
    @DisplayName("올해 영업활동현금흐름을 찾지 못하면 자료 없음이고 값은 0이 아니라 null이다")
    void earningsQualityWithoutCashIsNoData() {
        CheckpointItem item = CheckpointRules.earningsQuality(year(OPERATING_INCOME, 10), year());
        assertThat(item.status()).isEqualTo(CheckpointStatus.NO_DATA);
        assertThat(fact(item, "영업활동현금흐름 (올해)")).isNull();
        assertThat(reason(item, "영업활동현금흐름 (올해)")).isEqualTo(Reason.MISSING);
        assertThat(item.note()).isEqualTo("올해 영업활동현금흐름 값을 찾지 못했어요.");
    }

    @Test
    @DisplayName("매출채권 증가율이 매출 증가율보다 10%p 이상 크면 확인해 볼 점이고 두 증가율과 차이를 낸다")
    void receivablesBoundary() {
        YearAccounts previous = year(REVENUE, 1000, TRADE_RECEIVABLES, 100);
        // 매출 +10.0%, 매출채권 +20.0% → 차이 10.0%p(경계)
        CheckpointItem atThreshold = CheckpointRules.receivables(year(REVENUE, 1100, TRADE_RECEIVABLES, 120), previous);
        assertThat(atThreshold.status()).isEqualTo(CheckpointStatus.CHECK);
        assertThat(fact(atThreshold, "매출 증가율")).isEqualByComparingTo("10.0");
        assertThat(fact(atThreshold, "매출채권 증가율")).isEqualByComparingTo("20.0");
        assertThat(fact(atThreshold, "증가율 차이")).isEqualByComparingTo("10.0");
        // 매출채권 +19.9%(199/1000) → 차이 9.9%p
        CheckpointItem below = CheckpointRules.receivables(year(REVENUE, 1100, TRADE_RECEIVABLES, 1199),
                year(REVENUE, 1000, TRADE_RECEIVABLES, 1000));
        assertThat(fact(below, "증가율 차이")).isEqualByComparingTo("9.9");
        assertThat(below.status()).isEqualTo(CheckpointStatus.OK);
    }

    @Test
    @DisplayName("작년 매출채권이 0이면 증가율을 계산하지 않고 자료 없음과 사유를 남긴다")
    void receivablesPreviousZero() {
        CheckpointItem item = CheckpointRules.receivables(year(REVENUE, 1100, TRADE_RECEIVABLES, 50),
                year(REVENUE, 1000, TRADE_RECEIVABLES, 0));
        assertThat(item.status()).isEqualTo(CheckpointStatus.NO_DATA);
        assertThat(reason(item, "매출채권 증가율")).isEqualTo(Reason.PREVIOUS_ZERO);
        assertThat(reason(item, "증가율 차이")).isEqualTo(Reason.PREVIOUS_ZERO);
        assertThat(item.note()).isEqualTo("작년 매출채권 값이 0이라 증가율을 계산하지 않았어요.");
    }

    @Test
    @DisplayName("작년 매출이 음수면 증가율을 계산하지 않는다")
    void receivablesPreviousNegativeRevenue() {
        CheckpointItem item = CheckpointRules.receivables(year(REVENUE, 10, TRADE_RECEIVABLES, 50),
                year(REVENUE, -10, TRADE_RECEIVABLES, 40));
        assertThat(item.status()).isEqualTo(CheckpointStatus.NO_DATA);
        assertThat(reason(item, "매출 증가율")).isEqualTo(Reason.PREVIOUS_NEGATIVE);
    }

    @Test
    @DisplayName("매출채권 계정을 찾지 못하면 자료 없음이다")
    void receivablesMissingAccount() {
        CheckpointItem item = CheckpointRules.receivables(year(REVENUE, 1100), year(REVENUE, 1000));
        assertThat(item.status()).isEqualTo(CheckpointStatus.NO_DATA);
        assertThat(reason(item, "매출채권 (올해)")).isEqualTo(Reason.MISSING);
        assertThat(item.note()).isEqualTo("올해 매출채권 값을 찾지 못했어요.");
    }

    @Test
    @DisplayName("재고자산 증가율 − 매출 증가율의 경계는 10%p다")
    void inventoriesBoundary() {
        YearAccounts previous = year(REVENUE, 1000, INVENTORIES, 1000);
        assertThat(CheckpointRules.inventories(year(REVENUE, 1000, INVENTORIES, 1100), previous).status())
                .isEqualTo(CheckpointStatus.CHECK);
        assertThat(CheckpointRules.inventories(year(REVENUE, 1000, INVENTORIES, 1099), previous).status())
                .isEqualTo(CheckpointStatus.OK);
    }

    @Test
    @DisplayName("부채비율이 작년보다 20%p 이상 높아지면 확인해 볼 점이다")
    void debtRatioBoundary() {
        YearAccounts previous = year(TOTAL_LIABILITIES, 100, TOTAL_EQUITY, 100);
        CheckpointItem check = CheckpointRules.debtRatio(year(TOTAL_LIABILITIES, 120, TOTAL_EQUITY, 100), previous);
        assertThat(check.status()).isEqualTo(CheckpointStatus.CHECK);
        assertThat(fact(check, "부채비율 (올해)")).isEqualByComparingTo("120.0");
        assertThat(fact(check, "부채비율 (작년)")).isEqualByComparingTo("100.0");
        assertThat(fact(check, "부채비율 변화")).isEqualByComparingTo("20.0");
        assertThat(CheckpointRules.debtRatio(year(TOTAL_LIABILITIES, 1199, TOTAL_EQUITY, 1000), previous).status())
                .isEqualTo(CheckpointStatus.OK);
        // 부채비율이 낮아진 것은 기준에 걸리지 않는다
        assertThat(CheckpointRules.debtRatio(year(TOTAL_LIABILITIES, 10, TOTAL_EQUITY, 100), previous).status())
                .isEqualTo(CheckpointStatus.OK);
    }

    @Test
    @DisplayName("자본총계가 0 이하면 자본잠식을 사실로 적고 확인해 볼 점이며 부채비율은 계산하지 않는다")
    void debtRatioCapitalImpairment() {
        CheckpointItem item = CheckpointRules.debtRatio(year(TOTAL_LIABILITIES, 120, TOTAL_EQUITY, 0),
                year(TOTAL_LIABILITIES, 100, TOTAL_EQUITY, 100));
        assertThat(item.status()).isEqualTo(CheckpointStatus.CHECK);
        assertThat(item.note()).contains("자본잠식");
        assertThat(reason(item, "부채비율 (올해)")).isEqualTo(Reason.EQUITY_NOT_POSITIVE);
    }

    @Test
    @DisplayName("작년 자본총계가 0 이하면 변화를 계산하지 못해 자료 없음이다")
    void debtRatioPreviousImpairment() {
        CheckpointItem item = CheckpointRules.debtRatio(year(TOTAL_LIABILITIES, 120, TOTAL_EQUITY, 100),
                year(TOTAL_LIABILITIES, 100, TOTAL_EQUITY, -5));
        assertThat(item.status()).isEqualTo(CheckpointStatus.NO_DATA);
        assertThat(fact(item, "부채비율 (올해)")).isEqualByComparingTo("120.0");
        assertThat(reason(item, "부채비율 변화")).isEqualTo(Reason.EQUITY_NOT_POSITIVE);
    }

    @Test
    @DisplayName("단기 차입금은 두 해 모두 찾은 계정만 더하고, 매출 증가율보다 20%p 이상 빨리 늘면 확인해 볼 점이다")
    void shortTermBorrowingsBoundary() {
        YearAccounts previous = year(REVENUE, 1000, SHORT_TERM_BORROWINGS, 60, CURRENT_PORTION_OF_LONG_TERM_BORROWINGS,
                40);
        // 합계 100 → 130(+30.0%), 매출 +10.0% → 차이 20.0%p
        CheckpointItem check = CheckpointRules.shortTermBorrowings(year(REVENUE, 1100, SHORT_TERM_BORROWINGS, 80,
                CURRENT_PORTION_OF_LONG_TERM_BORROWINGS, 50), previous);
        assertThat(check.status()).isEqualTo(CheckpointStatus.CHECK);
        assertThat(fact(check, "단기 차입금 합계 (올해)")).isEqualByComparingTo("130");
        assertThat(fact(check, "증가율 차이")).isEqualByComparingTo("20.0");
        CheckpointItem ok = CheckpointRules.shortTermBorrowings(year(REVENUE, 1100, SHORT_TERM_BORROWINGS, 80,
                CURRENT_PORTION_OF_LONG_TERM_BORROWINGS, 49), previous);
        assertThat(ok.status()).isEqualTo(CheckpointStatus.OK);
    }

    @Test
    @DisplayName("유동성장기부채가 한 해에만 있으면 더하지 않고 그 사실을 적는다")
    void shortTermBorrowingsSkipsOneYearOnlyPart() {
        CheckpointItem item = CheckpointRules.shortTermBorrowings(
                year(REVENUE, 1000, SHORT_TERM_BORROWINGS, 100, CURRENT_PORTION_OF_LONG_TERM_BORROWINGS, 500),
                year(REVENUE, 1000, SHORT_TERM_BORROWINGS, 100));
        assertThat(fact(item, "단기 차입금 합계 (올해)")).isEqualByComparingTo("100");
        assertThat(item.status()).isEqualTo(CheckpointStatus.OK);
        assertThat(item.note()).isEqualTo("유동성장기부채 값은 한 해에만 있어 더하지 않았어요.");
    }

    @Test
    @DisplayName("단기차입금·유동성장기부채를 두 해 모두 찾지 못하면 0이 아니라 자료 없음이다")
    void shortTermBorrowingsWithoutAccountsIsNoData() {
        CheckpointItem item = CheckpointRules.shortTermBorrowings(year(REVENUE, 1100), year(REVENUE, 1000));
        assertThat(item.status()).isEqualTo(CheckpointStatus.NO_DATA);
        assertThat(fact(item, "단기 차입금 합계 (올해)")).isNull();
        assertThat(reason(item, "단기 차입금 합계 (올해)")).isEqualTo(Reason.MISSING);
    }

    private static Disclosure disclosure(String rceptNo, String name) {
        return new Disclosure(rceptNo, name, null, LocalDate.of(2026, 9, 1), null);
    }

    @Test
    @DisplayName("자금 조달 공시가 1건 이상이면 확인해 볼 점, 0건이면 특이사항 없음, 목록을 받지 못하면 자료 없음이다")
    void fundingDisclosures() {
        CheckpointItem one = CheckpointRules.funding(Optional.of(List.of(
                disclosure("20260901000001", "주요사항보고서(유상증자결정)"))));
        assertThat(one.status()).isEqualTo(CheckpointStatus.CHECK);
        assertThat(one.disclosures()).hasSize(1);
        assertThat(fact(one, "자금 조달 공시")).isEqualByComparingTo("1");
        assertThat(CheckpointRules.funding(Optional.of(List.of())).status()).isEqualTo(CheckpointStatus.OK);
        CheckpointItem unknown = CheckpointRules.funding(Optional.empty());
        assertThat(unknown.status()).isEqualTo(CheckpointStatus.NO_DATA);
        assertThat(reason(unknown, "자금 조달 공시")).isEqualTo(Reason.NOT_CHECKED);
    }

    @Test
    @DisplayName("적정이 아닌 감사의견이 있으면 확인해 볼 점이고 감사인 변경은 상태에 쓰지 않는다")
    void auditOpinion() {
        Disclosure annual = disclosure("20260320000001", "사업보고서 (2025.12)");
        assertThat(CheckpointRules.audit(Optional.of(List.of(annual)), 0).status()).isEqualTo(CheckpointStatus.CHECK);
        assertThat(CheckpointRules.audit(Optional.of(List.of()), 1).status()).isEqualTo(CheckpointStatus.OK);
        assertThat(CheckpointRules.audit(Optional.empty(), null).status()).isEqualTo(CheckpointStatus.NO_DATA);
    }

    @Test
    @DisplayName("일곱 항목을 정해 둔 순서로 늘 다 돌려준다")
    void allItemsInOrder() {
        List<CheckpointItem> items = CheckpointRules.all(year(), year(), Optional.empty(), Optional.empty(), null);
        assertThat(items).extracting(CheckpointItem::key).containsExactly(CheckpointKey.values());
        assertThat(items).allMatch(i -> i.status() == CheckpointStatus.NO_DATA);
    }

    @Test
    @DisplayName("항목 이름·설명·계산식·기준값·문장에 평가·추천하는 말을 쓰지 않는다")
    void usesNeutralWording() {
        List<String> banned = List.of("좋", "나쁘", "나쁜", "우수", "양호", "불량", "위험", "안전", "건전", "부실", "저평가",
                "고평가", "매수", "매도", "추천", "목표주가", "점수", "등급", "경고", "악재", "호재", "주의");
        List<String> texts = new ArrayList<>();
        for (CheckpointKey key : CheckpointKey.values()) {
            texts.addAll(List.of(key.title(), key.why(), key.formula(), key.threshold()));
        }
        for (CheckpointStatus status : CheckpointStatus.values()) {
            texts.add(status.label());
        }
        for (CheckpointReason reason : CheckpointReason.values()) {
            texts.add(reason.message());
        }
        YearAccounts current = year(OPERATING_INCOME, 10, OPERATING_CASH_FLOW, -1, TOTAL_LIABILITIES, 1,
                TOTAL_EQUITY, -1, SHORT_TERM_BORROWINGS, 5);
        YearAccounts previous = year(OPERATING_INCOME, 5, OPERATING_CASH_FLOW, 3, TOTAL_LIABILITIES, 1,
                TOTAL_EQUITY, 0, REVENUE, 0, CURRENT_PORTION_OF_LONG_TERM_BORROWINGS, 3);
        Disclosure annual = disclosure("20260320000001", "사업보고서 (2025.12)");
        for (CheckpointItem item : CheckpointRules.all(current, previous, Optional.of(List.of(annual)),
                Optional.of(List.of(annual)), 1)) {
            if (item.note() != null) {
                texts.add(item.note());
            }
            item.facts().forEach(f -> texts.add(f.label()));
        }
        for (String text : texts) {
            for (String word : banned) {
                assertThat(text).as(text).doesNotContain(word);
            }
        }
    }
}
