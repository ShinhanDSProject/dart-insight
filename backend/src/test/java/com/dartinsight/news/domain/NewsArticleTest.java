package com.dartinsight.news.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class NewsArticleTest {

    @Test
    @DisplayName("태그와 HTML 엔티티를 빼고, 원문 링크의 도메인을 언론사로, 발행 시각을 한국 시간으로 읽는다")
    void cleansTitleAndReadsSourceAndTime() {
        NewsArticle article = NewsArticle.of("<b>삼성전자</b>, &quot;새 공장&quot; 착공",
                "https://www.example-news.co.kr/a/1", "https://n.news.naver.com/a/1",
                "<b>삼성전자</b>가 &amp; 착공식을 열었다", "Tue, 03 Nov 2026 02:52:00 +0000").orElseThrow();

        assertThat(article.title()).isEqualTo("삼성전자, \"새 공장\" 착공");
        assertThat(article.description()).isEqualTo("삼성전자가 & 착공식을 열었다");
        assertThat(article.url()).isEqualTo("https://www.example-news.co.kr/a/1");
        assertThat(article.source()).isEqualTo("example-news.co.kr");
        assertThat(article.publishedAt()).isEqualTo(LocalDateTime.of(2026, 11, 3, 11, 52));
    }

    @Test
    @DisplayName("원문 링크가 없거나 http(s)가 아니면 네이버 뉴스 링크를 쓰고, 시각을 읽지 못하면 null, 제목이나 링크가 없으면 버린다")
    void fallsBackAndDropsBrokenItems() {
        NewsArticle article = NewsArticle.of("삼성전자 소식", null, "https://n.news.naver.com/a/2", null, "어제")
                .orElseThrow();

        assertThat(article.url()).isEqualTo("https://n.news.naver.com/a/2");
        assertThat(article.source()).isEqualTo("n.news.naver.com");
        assertThat(article.publishedAt()).isNull();
        assertThat(article.description()).isEmpty();
        assertThat(NewsArticle.of("<b></b>", "https://a.kr/1", null, null, null)).isEmpty();
        assertThat(NewsArticle.of("제목", null, null, null, null)).isEmpty();
        assertThat(NewsArticle.of("제목", "javascript:alert(1)", "https://n.news.naver.com/a/3", null, null).orElseThrow()
                .url()).isEqualTo("https://n.news.naver.com/a/3");
        assertThat(NewsArticle.of("제목", "javascript:alert(1)", null, null, null)).isEmpty();
    }

    @Test
    @DisplayName("제목에 회사 이름이 있는지는 공백과 대소문자를 무시하고 본다")
    void mentionsIgnoresSpacesAndCase() {
        NewsArticle article = NewsArticle.of("삼성 전자, SK하이닉스와 협력", "https://a.kr/1", null, null, null)
                .orElseThrow();

        assertThat(article.mentions("삼성전자")).isTrue();
        assertThat(article.mentions("sk하이닉스")).isTrue();
        assertThat(article.mentions("LG전자")).isFalse();
        assertThat(article.mentions(" ")).isFalse();
    }
}
