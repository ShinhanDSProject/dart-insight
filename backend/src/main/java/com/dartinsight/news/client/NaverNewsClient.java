package com.dartinsight.news.client;

import com.dartinsight.news.config.NaverSearchProperties;
import com.dartinsight.news.dto.NaverNewsItem;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * NAVER API HUB 뉴스 검색 호출(ADR-0046). 키는 요청 헤더에만 넣고 로그·예외 메시지에는 남기지 않는다.
 * 키가 없거나 호출·응답이 잘못되면 키 없는 사유만 담은 IllegalStateException을 던진다.
 */
@Component
public class NaverNewsClient {

    private final NaverSearchProperties properties;
    private final JsonMapper jsonMapper;
    private final RestClient restClient;

    public NaverNewsClient(NaverSearchProperties properties, JsonMapper jsonMapper) {
        this.properties = properties;
        this.jsonMapper = jsonMapper;
        HttpClient httpClient = HttpClient.newBuilder().connectTimeout(properties.connectTimeout()).build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(properties.readTimeout());
        this.restClient = RestClient.builder().requestFactory(requestFactory).build();
    }

    /** query로 검색한 최신순 뉴스 display건. 결과가 없으면 빈 목록 */
    public List<NaverNewsItem> latest(String query, int display) {
        if (!properties.hasKeys()) {
            throw new IllegalStateException("NAVER_SEARCH_CLIENT_ID·NAVER_SEARCH_CLIENT_SECRET가 없습니다");
        }
        URI uri = URI.create(properties.baseUrl() + NaverSearchPaths.NEWS + "?query="
                + URLEncoder.encode(query, StandardCharsets.UTF_8) + "&display=" + display + "&sort=date");
        JsonNode root;
        try {
            String body = restClient.get().uri(uri)
                    .header("X-NCP-APIGW-API-KEY-ID", properties.clientId())
                    .header("X-NCP-APIGW-API-KEY", properties.clientSecret())
                    .exchange((request, response) -> {
                        if (response.getStatusCode().isError()) {
                            throw new IllegalStateException("뉴스 검색 응답 상태: " + response.getStatusCode().value());
                        }
                        return new String(response.getBody().readAllBytes(), StandardCharsets.UTF_8);
                    });
            root = jsonMapper.readTree(body);
        } catch (RestClientException | JacksonException e) {
            // 예외 메시지에 요청 정보가 섞일 수 있어 종류만 남긴다
            throw new IllegalStateException("뉴스 검색 호출 실패: " + e.getClass().getSimpleName());
        }
        JsonNode items = root.path("items");
        if (!items.isArray()) {
            throw new IllegalStateException("뉴스 검색 응답에 items가 없습니다");
        }
        List<NaverNewsItem> list = new ArrayList<>();
        for (JsonNode item : items) {
            list.add(new NaverNewsItem(text(item, "title"), text(item, "originallink"), text(item, "link"),
                    text(item, "description"), text(item, "pubDate")));
        }
        return list;
    }

    private static String text(JsonNode item, String field) {
        String value = item.path(field).asString("").trim();
        return value.isEmpty() ? null : value;
    }
}
