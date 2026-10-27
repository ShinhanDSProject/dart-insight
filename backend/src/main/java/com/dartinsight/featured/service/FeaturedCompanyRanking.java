package com.dartinsight.featured.service;

import com.dartinsight.company.domain.Company;
import com.dartinsight.datagokr.dto.StockPriceRow;
import com.dartinsight.featured.domain.FeaturedCompany;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 시세 종목을 대표 기업 순위로 바꾼다. 시세 응답 dto를 받으므로 domain이 아니라 이 패키지에 둔다(계층 규칙). 상태가 없다.
 */
final class FeaturedCompanyRanking {

    private FeaturedCompanyRanking() {
    }

    /**
     * 시가총액 큰 순으로, 우리 기업 목록과 하나로 이어지는 종목만 limit곳. 순위는 이어진 종목 안에서 1부터 다시 매긴다.
     * 우선주처럼 종목코드가 없거나, 같은 종목코드의 기업이 여럿이면 뺀다.
     *
     * @param byStockCode 종목코드 → 그 종목코드의 기업들
     */
    static List<FeaturedCompany> rank(List<StockPriceRow> rows, Map<String, List<Company>> byStockCode, int limit,
            LocalDateTime fetchedAt) {
        List<FeaturedCompany> ranked = new ArrayList<>();
        Set<String> corpCodes = new HashSet<>();
        for (StockPriceRow row : rows.stream().sorted(Comparator.comparingLong(StockPriceRow::marketCap).reversed()).toList()) {
            List<Company> matches = byStockCode.getOrDefault(row.stockCode(), List.of());
            if (matches.size() != 1) {
                // 없거나, 같은 종목코드의 기업이 여럿이면 어느 기업인지 정할 수 없어 뺀다
                continue;
            }
            Company company = matches.get(0);
            if (!corpCodes.add(company.getCorpCode())) {
                continue;
            }
            ranked.add(FeaturedCompany.create(ranked.size() + 1, company.getCorpCode(), row.marketCap(),
                    row.baseDate(), fetchedAt));
            if (ranked.size() == limit) {
                break;
            }
        }
        return ranked;
    }
}
