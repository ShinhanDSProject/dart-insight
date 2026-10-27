package com.dartinsight.datagokr.client;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.dartinsight.dart.client.FakeOpenDartServer;
import com.dartinsight.dart.client.FakeOpenDartServer.Response;
import com.dartinsight.datagokr.config.DataGoKrProperties;
import com.dartinsight.datagokr.dto.StockPriceRow;
import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class StockPriceClientTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 10, 27);
    private final FakeOpenDartServer server = start();

    @AfterEach
    void stop() {
        server.close();
    }

    @Test
    @DisplayName("유가증권시장 종목만 읽고, 'A'로 시작하는 종목코드와 숫자가 아닌 시가총액을 정리한다")
    void readsKospiRowsOnly() {
        server.on(DataGoKrPaths.STOCK_PRICE, Response.json(page(3, """
                {"basDt":"20261026","srtnCd":"005930","itmsNm":"삼성전자","mrktCtg":"KOSPI","mrktTotAmt":"1338000000000000"},
                {"basDt":"20261026","srtnCd":"A000660","itmsNm":"SK하이닉스","mrktCtg":"KOSPI","mrktTotAmt":"995000000000000"},
                {"basDt":"20261026","srtnCd":"035720","itmsNm":"카카오","mrktCtg":"KOSDAQ","mrktTotAmt":"20000000000000"},
                {"basDt":"20261026","srtnCd":"999999","itmsNm":"이상한 값","mrktCtg":"KOSPI","mrktTotAmt":"-"}
                """)));

        List<StockPriceRow> rows = client("test-key").latestKospi(TODAY);

        assertThat(rows).extracting(StockPriceRow::stockCode).containsExactly("005930", "000660");
        assertThat(rows.get(0).baseDate()).isEqualTo(LocalDate.of(2026, 10, 26));
        assertThat(rows.get(0).marketCap()).isEqualTo(1_338_000_000_000_000L);
    }

    @Test
    @DisplayName("어제 자료가 없으면 하루씩 거슬러 종목이 나온 첫 기준일을 쓴다")
    void walksBackToLatestTradingDay() {
        server.on(DataGoKrPaths.STOCK_PRICE,
                Response.json(page(0, "")),
                Response.json(page(0, "")),
                Response.json(page(1, """
                        {"basDt":"20261024","srtnCd":"005930","itmsNm":"삼성전자","mrktCtg":"KOSPI","mrktTotAmt":"1"}
                        """)));

        List<StockPriceRow> rows = client("test-key").latestKospi(TODAY);

        assertThat(rows).singleElement().extracting(StockPriceRow::baseDate).isEqualTo(LocalDate.of(2026, 10, 24));
        assertThat(server.requests()).hasSize(3);
        assertThat(server.requests().get(0)).contains("basDt=20261026").contains("mrktCls=KOSPI");
        assertThat(server.requests().get(2)).contains("basDt=20261024");
    }

    @Test
    @DisplayName("키의 + / = 는 인코딩된 모양으로 넣어도 원래 모양으로 넣어도 같은 값으로 보낸다")
    void encodesKeyOnce() {
        server.on(DataGoKrPaths.STOCK_PRICE, Response.json(page(1, """
                {"basDt":"20261026","srtnCd":"005930","itmsNm":"삼성전자","mrktCtg":"KOSPI","mrktTotAmt":"1"}
                """)));

        client("ab%2Bc%2Fd%3D%3D").latestKospi(TODAY);
        client("ab+c/d==").latestKospi(TODAY);

        assertThat(server.requests()).allSatisfy(uri -> assertThat(uri).contains("serviceKey=ab%2Bc%2Fd%3D%3D"));
    }

    @Test
    @DisplayName("등록되지 않은 키처럼 오류 응답이면 사유 코드로 실패하고, 메시지에 키를 남기지 않는다")
    void failsWithReasonCodeWithoutKey() {
        server.on(DataGoKrPaths.STOCK_PRICE, Response.json("""
                {"OpenAPI_ServiceResponse":{"cmmMsgHeader":{"errMsg":"SERVICE_KEY_IS_NOT_REGISTERED_ERROR",
                "returnAuthMsg":"등록되지 않은 서비스키","returnReasonCode":"30"}}}
                """));

        assertThatThrownBy(() -> client("secret-key-value").latestKospi(TODAY))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("30")
                .hasMessageNotContaining("secret-key-value");
    }

    @Test
    @DisplayName("인코딩된 키에 섞인 '+'는 공백이 아니라 키의 글자로 둔다")
    void keepsPlusInEncodedKey() {
        assertThat(StockPriceClient.decodedKey("%2Fabc+def")).isEqualTo("/abc+def");
        assertThat(StockPriceClient.decodedKey(" ab+c/d== ")).isEqualTo("ab+c/d==");
    }

    @Test
    @DisplayName("서버에 닿지 못하면 실패하고, 메시지에 요청 주소의 키를 남기지 않는다")
    void hidesKeyOnTransportFailure() {
        DataGoKrProperties properties = new DataGoKrProperties("secret-key-value", "http://127.0.0.1:1",
                Duration.ofSeconds(1), Duration.ofSeconds(1));
        StockPriceClient client = new StockPriceClient(properties, JsonMapper.builder().build());

        assertThatThrownBy(() -> client.latestKospi(TODAY))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageNotContaining("secret-key-value")
                .hasNoCause();
    }

    @Test
    @DisplayName("totalCount가 없거나, 페이지가 중간에 끊기거나, 필수 항목이 없으면 일부만 돌려주지 않고 실패한다")
    void failsOnMalformedPages() {
        server.on(DataGoKrPaths.STOCK_PRICE, Response.json("""
                {"response":{"header":{"resultCode":"00"},"body":{"items":""}}}
                """));
        assertThatThrownBy(() -> client("test-key").latestKospi(TODAY)).hasMessageContaining("totalCount");

        server.on(DataGoKrPaths.STOCK_PRICE,
                Response.json(page(1001, """
                        {"basDt":"20261026","srtnCd":"005930","itmsNm":"삼성전자","mrktCtg":"KOSPI","mrktTotAmt":"1"}
                        """)),
                Response.json(page(0, "").replace("\"totalCount\":0", "\"totalCount\":1001")));
        assertThatThrownBy(() -> client("test-key").latestKospi(TODAY)).hasMessageContaining("끊겼");

        server.on(DataGoKrPaths.STOCK_PRICE, Response.json(page(1, """
                {"basDt":"20261026","srtnCd":"005930","itmsNm":"삼성전자","mrktCtg":"KOSPI","marketCap":"1"}
                """)));
        assertThatThrownBy(() -> client("test-key").latestKospi(TODAY)).hasMessageContaining("mrktTotAmt");
    }

    @Test
    @DisplayName("종목이 하나면 item이 객체로 와도 읽고, 여러 페이지를 이어 읽는다")
    void readsSingleObjectAndPages() {
        String one = """
                {"response":{"header":{"resultCode":"00"},"body":{"totalCount":2,"items":{"item":
                {"basDt":"20261026","srtnCd":"%s","itmsNm":"x","mrktCtg":"KOSPI","mrktTotAmt":"1"}}}}}
                """;
        server.on(DataGoKrPaths.STOCK_PRICE, Response.json(one.formatted("005930")), Response.json(one.formatted("000660")));

        assertThat(client("test-key").latestKospi(TODAY)).extracting(StockPriceRow::stockCode)
                .containsExactly("005930", "000660");
        assertThat(server.requests().get(1)).contains("pageNo=2");
    }

    private StockPriceClient client(String key) {
        DataGoKrProperties properties = new DataGoKrProperties(key, server.baseUrl(), Duration.ofSeconds(1),
                Duration.ofSeconds(2));
        return new StockPriceClient(properties, JsonMapper.builder().build());
    }

    /** 정상 응답 한 페이지. 종목이 없으면 items는 빈 문자열이다 */
    private static String page(int total, String items) {
        String body = total == 0 ? "\"\"" : "{\"item\":[" + items.strip() + "]}";
        return """
                {"response":{"header":{"resultCode":"00","resultMsg":"NORMAL SERVICE."},
                "body":{"numOfRows":1000,"pageNo":1,"totalCount":%d,"items":%s}}}
                """.formatted(total, body);
    }

    private static FakeOpenDartServer start() {
        try {
            return new FakeOpenDartServer();
        } catch (java.io.IOException e) {
            throw new IllegalStateException(e);
        }
    }
}
