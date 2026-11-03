package com.dartinsight.news.client;

/**
 * NAVER API HUB 경로. {@link NaverNewsClient}가 부르는 경로는 여기에만 둔다.
 */
public final class NaverSearchPaths {

    /** 뉴스 검색(https://api.ncloud-docs.com/docs/naver-api-hub-search-news) */
    public static final String NEWS = "/search/v1/news";

    private NaverSearchPaths() {
    }
}
