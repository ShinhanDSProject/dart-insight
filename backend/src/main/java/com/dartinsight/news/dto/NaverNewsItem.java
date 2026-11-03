package com.dartinsight.news.dto;

/**
 * NAVER API HUB 뉴스 검색 응답 items 한 건(받은 그대로). title·description에는 일치한 낱말을 감싼 b 태그와 HTML 엔티티가 있다.
 *
 * @param originalLink 언론사 원문 주소(originallink). 없을 수 있다
 * @param link         네이버 뉴스 주소. 네이버에 없는 기사면 원문 주소
 * @param pubDate      RFC 822 모양(예: Thu, 11 Jun 2026 18:34:00 +0900)
 */
public record NaverNewsItem(String title, String originalLink, String link, String description, String pubDate) {
}
