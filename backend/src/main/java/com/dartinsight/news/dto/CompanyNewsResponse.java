package com.dartinsight.news.dto;

import com.dartinsight.news.domain.CompanyNews;
import com.dartinsight.news.domain.NewsArticle;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 기업 뉴스(docs/api-spec.md GET /api/companies/{corpCode}/news, #592).
 */
public record CompanyNewsResponse(String corpCode, String query, LocalDateTime fetchedAt, List<Item> items) {

    public record Item(String title, String description, String url, String source, LocalDateTime publishedAt) {

        static Item from(NewsArticle article) {
            return new Item(article.title(), article.description(), article.url(), article.source(),
                    article.publishedAt());
        }
    }

    public static CompanyNewsResponse from(CompanyNews news) {
        return new CompanyNewsResponse(news.corpCode(), news.query(), news.fetchedAt(),
                news.items().stream().map(Item::from).toList());
    }
}
