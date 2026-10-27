package com.dartinsight.featured.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dartinsight.dart.client.FakeOpenDartServer;
import com.dartinsight.dart.client.FakeOpenDartServer.Response;
import com.dartinsight.datagokr.client.DataGoKrPaths;
import com.dartinsight.featured.service.FeaturedCompanyService;
import com.dartinsight.support.TestData;
import java.io.IOException;
import org.junit.jupiter.api.AfterEach;
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

@SpringBootTest
@AutoConfigureMockMvc
class FeaturedCompanyApiTest {

    private static final FakeOpenDartServer SERVER = startServer();
    private static final String TWO_DAYS = """
            {"response":{"header":{"resultCode":"00","resultMsg":"NORMAL SERVICE."},
            "body":{"numOfRows":1000,"pageNo":1,"totalCount":4,"items":{"item":[
            {"basDt":"20261026","srtnCd":"000660","itmsNm":"SK하이닉스","mrktCtg":"KOSPI","mrktTotAmt":"995000000000000"},
            {"basDt":"20261026","srtnCd":"005930","itmsNm":"삼성전자","mrktCtg":"KOSPI","mrktTotAmt":"1338000000000000"},
            {"basDt":"20261026","srtnCd":"005935","itmsNm":"삼성전자우","mrktCtg":"KOSPI","mrktTotAmt":"120000000000000"},
            {"basDt":"20261026","srtnCd":"005380","itmsNm":"현대차","mrktCtg":"KOSPI","mrktTotAmt":"50000000000000"}
            ]}}}}
            """;

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired FeaturedCompanyService service;

    @DynamicPropertySource
    static void dataGoKr(DynamicPropertyRegistry registry) {
        registry.add("app.data-go-kr.base-url", SERVER::baseUrl);
        registry.add("app.data-go-kr.read-timeout", () -> "2s");
        registry.add("app.featured.limit", () -> "2");
    }

    @BeforeEach
    void setUp() {
        TestData.clearAll(jdbc);
        insertCompany("00126380", "삼성전자", "005930");
        insertCompany("00164779", "SK하이닉스", "000660");
        insertCompany("00164742", "현대자동차", "005380");
    }

    @AfterEach
    void clear() {
        TestData.clearAll(jdbc);
    }

    @Test
    @DisplayName("아직 받지 않았으면 에러 없이 기준일은 null, 목록은 비어 있다")
    void emptyBeforeFirstFetch() throws Exception {
        assertThat(service.isStale()).isTrue();
        mvc.perform(get("/api/featured-companies"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.baseDate").doesNotExist())
                .andExpect(jsonPath("$.items", hasSize(0)))
                .andExpect(jsonPath("$.source").value("금융위원회, 공공데이터포털"));
    }

    @Test
    @DisplayName("시가총액 큰 순으로 우리 기업 목록과 이어지는 종목만 limit곳 저장하고, 시가총액은 내보내지 않는다")
    void ranksByMarketCapWithoutExposingIt() throws Exception {
        SERVER.on(DataGoKrPaths.STOCK_PRICE, Response.json(TWO_DAYS));

        assertThat(service.refresh()).isEqualTo(2);

        mvc.perform(get("/api/featured-companies"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.baseDate").value("2026-10-26"))
                .andExpect(jsonPath("$.items[*].corpCode", contains("00126380", "00164779")))
                .andExpect(jsonPath("$.items[*].rank", contains(1, 2)))
                .andExpect(jsonPath("$.items[0].corpName").value("삼성전자"))
                .andExpect(jsonPath("$.items[0].stockCode").value("005930"))
                .andExpect(jsonPath("$.items[0].marketCap").doesNotExist());
        assertThat(service.isStale()).isFalse();
    }

    @Test
    @DisplayName("다시 받다 실패하면 저장된 목록을 그대로 쓴다")
    void keepsListWhenRefreshFails() throws Exception {
        SERVER.on(DataGoKrPaths.STOCK_PRICE, Response.json(TWO_DAYS));
        service.refresh();
        SERVER.on(DataGoKrPaths.STOCK_PRICE, Response.json("""
                {"OpenAPI_ServiceResponse":{"cmmMsgHeader":{"errMsg":"SERVICE_KEY_IS_NOT_REGISTERED_ERROR","returnReasonCode":"30"}}}
                """));

        assertThatThrownBy(service::refresh).isInstanceOf(IllegalStateException.class);

        mvc.perform(get("/api/featured-companies"))
                .andExpect(jsonPath("$.items[*].corpCode", contains("00126380", "00164779")));
    }

    @Test
    @DisplayName("받은 종목이 우리 기업 목록과 하나도 이어지지 않으면 저장된 목록을 지우지 않는다")
    void keepsListWhenNothingMatches() throws Exception {
        SERVER.on(DataGoKrPaths.STOCK_PRICE, Response.json(TWO_DAYS));
        service.refresh();
        jdbc.update("UPDATE company SET stock_code = NULL WHERE corp_code = '00164742'");
        SERVER.on(DataGoKrPaths.STOCK_PRICE, Response.json(TWO_DAYS.replace("\"005930\"", "\"111111\"")
                .replace("\"000660\"", "\"222222\"").replace("\"005380\"", "\"333333\"")));

        assertThat(service.refresh()).isZero();

        mvc.perform(get("/api/featured-companies")).andExpect(jsonPath("$.items", hasSize(2)));
    }

    @Test
    @DisplayName("같은 종목코드의 기업이 여럿이면 어느 기업인지 정할 수 없어 빼고 다음 종목으로 순위를 채운다")
    void skipsAmbiguousStockCode() throws Exception {
        insertCompany("00999999", "옛 삼성전자", "005930");
        SERVER.on(DataGoKrPaths.STOCK_PRICE, Response.json(TWO_DAYS));

        assertThat(service.refresh()).isEqualTo(2);

        mvc.perform(get("/api/featured-companies"))
                .andExpect(jsonPath("$.items[*].corpCode", contains("00164779", "00164742")))
                .andExpect(jsonPath("$.items[*].rank", contains(1, 2)));
    }

    private void insertCompany(String corpCode, String name, String stockCode) {
        jdbc.update("INSERT INTO company (corp_code, corp_name, stock_code, created_at, updated_at)"
                + " VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)", corpCode, name, stockCode);
    }

    private static FakeOpenDartServer startServer() {
        try {
            return new FakeOpenDartServer();
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }
}
