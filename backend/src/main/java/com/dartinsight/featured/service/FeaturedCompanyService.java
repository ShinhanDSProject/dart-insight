package com.dartinsight.featured.service;

import com.dartinsight.company.domain.Company;
import com.dartinsight.company.service.CompanyService;
import com.dartinsight.datagokr.client.StockPriceClient;
import com.dartinsight.datagokr.dto.StockPriceRow;
import com.dartinsight.featured.config.FeaturedProperties;
import com.dartinsight.featured.domain.FeaturedCompany;
import com.dartinsight.featured.dto.FeaturedCompanyListResponse;
import com.dartinsight.featured.repository.FeaturedCompanyRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 첫 화면 대표 기업(1.5, #399, ADR-0033). 유가증권시장 시가총액 상위 종목을 우리 기업 목록과 이어 저장하고, 저장된 목록만 내준다.
 */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class FeaturedCompanyService {

    private final FeaturedCompanyRepository featured;
    private final CompanyService companyService;
    private final StockPriceClient stockPriceClient;
    private final FeaturedProperties properties;
    private final TransactionTemplate transactionTemplate;
    private final Clock clock;

    public FeaturedCompanyListResponse list() {
        List<FeaturedCompany> rows = featured.findAllByOrderByRankNoAsc();
        Map<String, Company> companies = companyService.getAll(rows.stream().map(FeaturedCompany::getCorpCode).toList())
                .stream().collect(Collectors.toMap(Company::getCorpCode, Function.identity()));
        return FeaturedCompanyListResponse.of(rows, companies);
    }

    /** 대표 기업 고유번호, 순위 순(1.7 시즌 순위의 후보) */
    public List<String> corpCodes() {
        return featured.findAllByOrderByRankNoAsc().stream().map(FeaturedCompany::getCorpCode).toList();
    }

    /** 비었거나 받은 지 refresh-after가 지났으면 다시 받아야 한다. */
    public boolean isStale() {
        List<FeaturedCompany> rows = featured.findAllByOrderByRankNoAsc();
        return rows.isEmpty()
                || rows.get(0).getFetchedAt().isBefore(LocalDateTime.now(clock).minus(properties.refreshAfter()));
    }

    /**
     * 공공데이터포털에서 받아 목록 전체를 바꾸고 저장한 기업 수를 돌려준다. 외부 호출은 트랜잭션 밖에서 한다(LY-2).
     * 받은 종목이 없거나 우리 기업 목록과 하나도 이어지지 않으면 저장된 목록을 그대로 두고 0을 돌려준다.
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public int refresh() {
        List<StockPriceRow> rows = stockPriceClient.latestKospi(LocalDate.now(clock));
        List<FeaturedCompany> ranked = rank(rows, LocalDateTime.now(clock));
        if (ranked.isEmpty()) {
            return 0;
        }
        transactionTemplate.executeWithoutResult(status -> {
            featured.deleteAllInBatch();
            featured.saveAll(ranked);
        });
        return ranked.size();
    }

    /** 받은 종목의 종목코드로 우리 기업을 찾아 순위를 매긴다({@link FeaturedCompanyRanking#rank}) */
    private List<FeaturedCompany> rank(List<StockPriceRow> rows, LocalDateTime fetchedAt) {
        Map<String, List<Company>> byStockCode = companyService.findByStockCodes(
                        rows.stream().map(StockPriceRow::stockCode).collect(Collectors.toSet()))
                .stream().collect(Collectors.groupingBy(Company::getStockCode));
        return FeaturedCompanyRanking.rank(rows, byStockCode, properties.limit(), fetchedAt);
    }
}
