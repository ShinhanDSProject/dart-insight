package com.dartinsight.news.service;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.company.domain.Company;
import com.dartinsight.company.service.CompanyService;
import com.dartinsight.news.client.NaverNewsClient;
import com.dartinsight.news.config.NaverSearchProperties;
import com.dartinsight.news.domain.CompanyNews;
import com.dartinsight.news.domain.CompanyNewsCache;
import com.dartinsight.news.domain.NewsArticle;
import com.dartinsight.news.dto.NaverNewsItem;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * 기업 뉴스(#592, ADR-0046). 기업 이름으로 최신 뉴스를 받아 제목에 그 이름이 있는 기사만 남기고, 기업별로 메모리에 캐시한다.
 * 뉴스는 화면 목록에만 쓰고 LLM에는 넣지 않는다(네이버 약관). DB를 쓰지 않아 트랜잭션이 없다.
 */
@Service
public class CompanyNewsService {

    /** 제목으로 거르면 크게 줄어(2026-11-03 삼성전자 30건 중 6건) 한 번에 받을 수 있는 최대로 받는다 */
    static final int FETCH_SIZE = 100;
    static final int MAX_ITEMS = 10;
    private static final Logger log = LoggerFactory.getLogger(CompanyNewsService.class);

    private final CompanyService companyService;
    private final NaverNewsClient naverNewsClient;
    private final Clock clock;
    private final CompanyNewsCache cache;

    public CompanyNewsService(CompanyService companyService, NaverNewsClient naverNewsClient,
            NaverSearchProperties properties, Clock clock) {
        this.companyService = companyService;
        this.naverNewsClient = naverNewsClient;
        this.clock = clock;
        this.cache = new CompanyNewsCache(properties.cacheTtl());
    }

    /**
     * 그 기업의 최신 뉴스. 받은 지 cache-ttl이 안 지났으면 캐시를 준다.
     *
     * @throws ApiException 없는 기업(404 COMPANY_NOT_FOUND), 키가 없거나 호출 실패(503 COMPANY_NEWS_UNAVAILABLE)
     */
    public CompanyNews news(String corpCode) {
        Company company = companyService.get(corpCode);
        LocalDateTime now = LocalDateTime.now(clock);
        Optional<CompanyNews> cached = cache.fresh(corpCode, now);
        if (cached.isPresent()) {
            return cached.get();
        }
        String query = company.getCorpName();
        List<NaverNewsItem> fetched;
        try {
            fetched = naverNewsClient.latest(query, FETCH_SIZE);
        } catch (IllegalStateException e) {
            log.warn("기업 뉴스를 받지 못했습니다: {} {}", corpCode, e.getMessage());
            throw new ApiException(ErrorCode.COMPANY_NEWS_UNAVAILABLE);
        }
        List<NewsArticle> items = fetched.stream()
                .map(i -> NewsArticle.of(i.title(), i.originalLink(), i.link(), i.description(), i.pubDate()))
                .flatMap(Optional::stream)
                .filter(article -> article.mentions(query))
                .limit(MAX_ITEMS)
                .toList();
        CompanyNews news = new CompanyNews(corpCode, query, now, items);
        cache.put(news, now);
        return news;
    }
}
