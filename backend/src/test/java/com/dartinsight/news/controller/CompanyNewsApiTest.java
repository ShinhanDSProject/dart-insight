package com.dartinsight.news.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dartinsight.company.service.CompanyImportService;
import com.dartinsight.dart.client.FakeOpenDartServer;
import com.dartinsight.dart.client.FakeOpenDartServer.Response;
import com.dartinsight.dart.domain.CorpCodeEntry;
import com.dartinsight.news.client.NaverSearchPaths;
import com.dartinsight.support.TestData;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/** 회사와 기사는 가짜다. 응답 모양은 NAVER API HUB 뉴스 검색 개발 가이드(2026-11-03 확인)와 같다. */
@SpringBootTest
@AutoConfigureMockMvc
class CompanyNewsApiTest {

    private static final FakeOpenDartServer SERVER = startServer();

    @DynamicPropertySource
    static void naverSearch(DynamicPropertyRegistry registry) {
        registry.add("app.naver-search.base-url", SERVER::baseUrl);
        registry.add("app.naver-search.read-timeout", () -> "2s");
    }

    private static FakeOpenDartServer startServer() {
        try {
            return new FakeOpenDartServer();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private CompanyImportService companyImportService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        TestData.clearAll(jdbcTemplate);
        // 뉴스 캐시는 기업별이라 테스트마다 다른 기업을 쓴다
        companyImportService.save(List.of(
                new CorpCodeEntry("00000011", "예시전자", null, "900011", LocalDate.of(2026, 1, 1)),
                new CorpCodeEntry("00000012", "예시화학", null, "900012", LocalDate.of(2026, 1, 1)),
                new CorpCodeEntry("00000013", "예시건설", null, "900013", LocalDate.of(2026, 1, 1))));
    }

    @Test
    @DisplayName("제목에 회사 이름이 있는 기사만 최신순으로 주고, 30분 안에 다시 부르면 네이버를 부르지 않는다")
    void returnsMatchingArticlesAndCaches() throws Exception {
        SERVER.on(NaverSearchPaths.NEWS, Response.json("""
                {"total":3,"start":1,"display":3,"items":[
                  {"title":"<b>예시전자</b>, &quot;새 공장&quot; 착공","originallink":"https://www.a-news.kr/1",
                   "link":"https://n.news.naver.com/1","description":"<b>예시전자</b>가 착공식을 열었다",
                   "pubDate":"Tue, 03 Nov 2026 11:52:00 +0900"},
                  {"title":"반도체 업계 동향","originallink":"https://b-news.kr/2","link":"https://n.news.naver.com/2",
                   "description":"<b>예시전자</b> 등","pubDate":"Tue, 03 Nov 2026 11:00:00 +0900"},
                  {"title":"예시 전자 실적 발표","originallink":"","link":"https://n.news.naver.com/3",
                   "description":"","pubDate":"Tue, 03 Nov 2026 10:00:00 +0900"}
                ]}
                """));
        int before = SERVER.requests().size();

        mockMvc.perform(get("/api/companies/00000011/news"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.corpCode").value("00000011"))
                .andExpect(jsonPath("$.query").value("예시전자"))
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.items[0].title").value("예시전자, \"새 공장\" 착공"))
                .andExpect(jsonPath("$.items[0].description").value("예시전자가 착공식을 열었다"))
                .andExpect(jsonPath("$.items[0].url").value("https://www.a-news.kr/1"))
                .andExpect(jsonPath("$.items[0].source").value("a-news.kr"))
                .andExpect(jsonPath("$.items[0].publishedAt").value("2026-11-03T11:52:00"))
                .andExpect(jsonPath("$.items[1].url").value("https://n.news.naver.com/3"));
        mockMvc.perform(get("/api/companies/00000011/news"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(2)));

        assertThat(SERVER.requests().size() - before).isEqualTo(1);
    }

    @Test
    @DisplayName("네이버 호출이 실패하면 503 COMPANY_NEWS_UNAVAILABLE이고, 실패는 캐시하지 않는다")
    void failureIsNotCached() throws Exception {
        SERVER.on(NaverSearchPaths.NEWS, Response.status(500),
                Response.json("{\"total\":0,\"start\":1,\"display\":0,\"items\":[]}"));

        mockMvc.perform(get("/api/companies/00000012/news"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("COMPANY_NEWS_UNAVAILABLE"))
                .andExpect(jsonPath("$.traceId").isNotEmpty());
        mockMvc.perform(get("/api/companies/00000012/news"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(0)));
    }

    @Test
    @DisplayName("없는 기업이면 네이버를 부르지 않고 404 COMPANY_NOT_FOUND")
    void unknownCompany() throws Exception {
        int before = SERVER.requests().size();

        mockMvc.perform(get("/api/companies/99999999/news"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COMPANY_NOT_FOUND"));

        assertThat(SERVER.requests()).hasSize(before);
    }
}
