package com.dartinsight.news.domain;

import java.net.URI;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Locale;
import java.util.Optional;
import org.springframework.web.util.HtmlUtils;

/**
 * 화면에 보일 뉴스 한 건(ADR-0046). 본문은 받지 않고 제목·요약 한두 줄·원문 링크만 둔다.
 *
 * @param url         언론사 원문 주소. 없으면 네이버 뉴스 주소
 * @param source      url의 도메인(www. 뺌). 네이버 응답에 언론사 이름이 없어 도메인으로 보인다
 * @param publishedAt 한국 시간. 읽지 못하면 null
 */
public record NewsArticle(String title, String description, String url, String source, LocalDateTime publishedAt) {

    private static final ZoneId KOREA = ZoneId.of("Asia/Seoul");

    /** 네이버 응답 한 건에서 만든다. 제목이나 http(s) 링크가 없으면 비운다(화면이 링크로 그리므로 다른 스킴은 받지 않음) */
    public static Optional<NewsArticle> of(String title, String originalLink, String link, String description,
            String pubDate) {
        String url = webUrl(originalLink) != null ? originalLink : webUrl(link);
        String cleanTitle = clean(title);
        if (cleanTitle.isEmpty() || url == null) {
            return Optional.empty();
        }
        return Optional.of(new NewsArticle(cleanTitle, clean(description), url, source(url), publishedAt(pubDate)));
    }

    /** 제목에 회사 이름이 있는지(공백 무시, 대소문자 무시) */
    public boolean mentions(String corpName) {
        String name = compact(corpName);
        return !name.isEmpty() && compact(title).contains(name);
    }

    /** 일치한 낱말을 감싼 태그를 빼고 HTML 엔티티(&amp;quot; 등)를 글자로 되돌린다 */
    static String clean(String text) {
        if (text == null) {
            return "";
        }
        return HtmlUtils.htmlUnescape(text.replaceAll("<[^>]*>", "")).replaceAll("\\s+", " ").trim();
    }

    private static String webUrl(String url) {
        return url != null && (url.startsWith("https://") || url.startsWith("http://")) ? url : null;
    }

    static String source(String url) {
        try {
            String host = URI.create(url).getHost();
            if (host == null) {
                return null;
            }
            return host.startsWith("www.") ? host.substring(4) : host;
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    static LocalDateTime publishedAt(String pubDate) {
        if (pubDate == null) {
            return null;
        }
        try {
            return ZonedDateTime.parse(pubDate, DateTimeFormatter.RFC_1123_DATE_TIME).withZoneSameInstant(KOREA)
                    .toLocalDateTime();
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private static String compact(String text) {
        return text == null ? "" : text.replaceAll("\\s+", "").toLowerCase(Locale.ROOT);
    }
}
