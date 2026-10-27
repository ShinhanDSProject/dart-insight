package com.dartinsight.featured.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.dartinsight.company.domain.Company;
import com.dartinsight.datagokr.dto.StockPriceRow;
import com.dartinsight.featured.domain.FeaturedCompany;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class FeaturedCompanyRankingTest {

    private static final LocalDate BASE_DATE = LocalDate.of(2026, 10, 24);
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 27, 9, 0);

    private static Company company(String corpCode, String stockCode) {
        Company company = mock(Company.class);
        when(company.getCorpCode()).thenReturn(corpCode);
        when(company.getStockCode()).thenReturn(stockCode);
        return company;
    }

    private static StockPriceRow row(String stockCode, long marketCap) {
        return new StockPriceRow(BASE_DATE, stockCode, "종목" + stockCode, "KOSPI", marketCap);
    }

    @Test
    @DisplayName("시가총액 큰 순으로 하나로 이어지는 종목만 limit곳 두고, 순위는 1부터 다시 매긴다")
    void ranksUniquelyMatchedRowsByMarketCap() {
        Map<String, List<Company>> byStockCode = Map.of(
                "000001", List.of(company("00000001", "000001")),
                "000002", List.of(company("00000002", "000002"), company("00000022", "000002")),
                "000003", List.of(company("00000003", "000003")),
                "000004", List.of(company("00000004", "000004")));

        List<FeaturedCompany> ranked = FeaturedCompanyRanking.rank(List.of(
                row("000001", 100), row("000002", 500), row("000003", 300), row("999999", 900), row("000004", 50)),
                byStockCode, 2, NOW);

        assertThat(ranked).extracting(FeaturedCompany::getRankNo, FeaturedCompany::getCorpCode)
                .containsExactly(tuple(1, "00000003"), tuple(2, "00000001"));
    }
}
