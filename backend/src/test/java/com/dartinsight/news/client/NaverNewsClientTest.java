package com.dartinsight.news.client;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.dartinsight.dart.client.FakeOpenDartServer;
import com.dartinsight.dart.client.FakeOpenDartServer.Response;
import com.dartinsight.news.config.NaverSearchProperties;
import com.dartinsight.news.dto.NaverNewsItem;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

/** 응답 모양은 NAVER API HUB 뉴스 검색 개발 가이드(2026-11-03 확인)와 같다. 기사는 가짜다. */
class NaverNewsClientTest {

    private final FakeOpenDartServer server = start();

    @AfterEach
    void stop() {
        server.close();
    }

    @Test
    @DisplayName("검색어·개수·최신순을 쿼리로, 키를 헤더로 보내고 items를 받은 그대로 읽는다")
    void sendsKeysInHeadersAndReadsItems() {
        server.on(NaverSearchPaths.NEWS, Response.json("""
                {"lastBuildDate":"Tue, 03 Nov 2026 12:00:00 +0900","total":2,"start":1,"display":2,"items":[
                  {"title":"<b>삼성전자</b> 착공","originallink":"https://a.kr/1","link":"https://n.news.naver.com/1",
                   "description":"요약","pubDate":"Tue, 03 Nov 2026 11:52:00 +0900"},
                  {"title":"다른 기사","originallink":"","link":"https://n.news.naver.com/2","description":"",
                   "pubDate":"Tue, 03 Nov 2026 11:00:00 +0900"}
                ]}
                """));

        List<NaverNewsItem> items = client("id-1", "secret-1").latest("삼성 전자", 30);

        assertThat(items).hasSize(2);
        assertThat(items.get(0).title()).isEqualTo("<b>삼성전자</b> 착공");
        assertThat(items.get(1).originalLink()).isNull();
        assertThat(server.requests().get(0)).contains("query=%EC%82%BC%EC%84%B1+%EC%A0%84%EC%9E%90")
                .contains("display=30").contains("sort=date");
        assertThat(server.requestHeaders().get(0).get("x-ncp-apigw-api-key-id")).containsExactly("id-1");
        assertThat(server.requestHeaders().get(0).get("x-ncp-apigw-api-key")).containsExactly("secret-1");
    }

    @Test
    @DisplayName("키가 없으면 부르지 않고, 오류 상태나 items가 없는 응답이면 키 없는 사유로 실패한다")
    void failsWithoutLeakingKeys() {
        assertThatThrownBy(() -> client("", "secret-1").latest("삼성전자", 30))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("NAVER_SEARCH_CLIENT_ID");
        assertThat(server.requests()).isEmpty();

        server.on(NaverSearchPaths.NEWS, Response.status(401), Response.json("{\"total\":0}"));
        assertThatThrownBy(() -> client("id-1", "secret-1").latest("삼성전자", 30))
                .isInstanceOf(IllegalStateException.class).hasMessageNotContaining("secret-1");
        assertThatThrownBy(() -> client("id-1", "secret-1").latest("삼성전자", 30))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("items");
    }

    private NaverNewsClient client(String id, String secret) {
        return new NaverNewsClient(new NaverSearchProperties(id, secret, server.baseUrl(), Duration.ofSeconds(1),
                Duration.ofSeconds(2), Duration.ofMinutes(30)), JsonMapper.builder().build());
    }

    private static FakeOpenDartServer start() {
        try {
            return new FakeOpenDartServer();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
