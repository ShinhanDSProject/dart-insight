package com.dartinsight.datagokr.client;

import com.dartinsight.datagokr.config.DataGoKrProperties;
import com.dartinsight.datagokr.dto.StockPriceRow;
import java.net.URI;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * 공공데이터포털 '금융위원회_주식시세정보' 호출(ADR-0033). 유가증권시장 종목의 시가총액만 쓴다.
 * 인증키는 요청 주소에만 넣고 로그·예외 메시지에는 남기지 않는다. 호출·응답이 잘못되면 키 없는 사유만 담은 IllegalStateException을 던진다.
 */
@Component
public class StockPriceClient {

    static final String KOSPI = "KOSPI";
    private static final int PAGE_SIZE = 1000;
    private static final int MAX_PAGES = 5;
    /** 다음 영업일 오후에 갱신되고 연휴가 길 수 있어, 어제부터 이만큼 거슬러 첫 거래일을 찾는다 */
    private static final int LOOKBACK_DAYS = 10;
    private static final DateTimeFormatter BASIC_DATE = DateTimeFormatter.BASIC_ISO_DATE;
    private static final List<String> REQUIRED_FIELDS = List.of("basDt", "srtnCd", "itmsNm", "mrktCtg", "mrktTotAmt");

    private final DataGoKrProperties properties;
    private final JsonMapper jsonMapper;
    private final RestClient restClient;

    public StockPriceClient(DataGoKrProperties properties, JsonMapper jsonMapper) {
        this.properties = properties;
        this.jsonMapper = jsonMapper;
        HttpClient httpClient = HttpClient.newBuilder().connectTimeout(properties.connectTimeout()).build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(properties.readTimeout());
        this.restClient = RestClient.builder().requestFactory(requestFactory).build();
    }

    /** today 전날부터 거슬러, 유가증권시장 종목이 나온 첫 기준일의 종목 전부. 열흘 안에 없으면 빈 목록. */
    public List<StockPriceRow> latestKospi(LocalDate today) {
        for (int days = 1; days <= LOOKBACK_DAYS; days++) {
            List<StockPriceRow> rows = kospiOn(today.minusDays(days));
            if (!rows.isEmpty()) {
                return rows;
            }
        }
        return List.of();
    }

    /**
     * 그 기준일의 유가증권시장 종목 전부. 종목이 없는 날은 빈 목록.
     * 페이지·항목 모양이 예상과 다르거나 중간에 끊기면 일부만 저장하지 않도록 실패한다.
     */
    List<StockPriceRow> kospiOn(LocalDate baseDate) {
        List<StockPriceRow> rows = new ArrayList<>();
        int seen = 0;
        for (int page = 1; page <= MAX_PAGES; page++) {
            JsonNode body = call(baseDate, page);
            int total = totalCount(body);
            if (total == 0) {
                return rows;
            }
            List<JsonNode> items = items(body.path("items"));
            if (items.isEmpty()) {
                throw new IllegalStateException("공공데이터포털 응답이 중간에 끊겼습니다: " + seen + "/" + total);
            }
            for (JsonNode item : items) {
                addKospi(rows, item);
            }
            seen += items.size();
            if (seen >= total) {
                return rows;
            }
        }
        throw new IllegalStateException("공공데이터포털 응답 페이지가 너무 많습니다");
    }

    private static int totalCount(JsonNode body) {
        JsonNode node = body.path("totalCount");
        String text = node.isNumber() ? node.asString() : node.asString("").trim();
        if (!text.matches("\\d+")) {
            throw new IllegalStateException("공공데이터포털 응답에 totalCount가 없습니다");
        }
        return Integer.parseInt(text);
    }

    /** 종목이 여럿이면 배열, 하나면 객체, 없으면 빈 문자열로 온다. */
    private static List<JsonNode> items(JsonNode items) {
        JsonNode item = items.path("item");
        List<JsonNode> list = new ArrayList<>();
        if (item.isArray()) {
            item.forEach(list::add);
        } else if (item.isObject()) {
            list.add(item);
        }
        return list;
    }

    private JsonNode call(LocalDate baseDate, int page) {
        if (!properties.hasApiKey()) {
            throw new IllegalStateException("DATA_GO_KR_API_KEY가 없습니다");
        }
        Map<String, String> query = new LinkedHashMap<>();
        query.put("serviceKey", decodedKey(properties.apiKey()));
        query.put("resultType", "json");
        query.put("numOfRows", String.valueOf(PAGE_SIZE));
        query.put("pageNo", String.valueOf(page));
        query.put("basDt", baseDate.format(BASIC_DATE));
        query.put("mrktCls", KOSPI);
        String body;
        JsonNode root;
        try {
            body = restClient.get().uri(uri(query))
                    .exchange((request, response) -> new String(response.getBody().readAllBytes(), StandardCharsets.UTF_8));
            root = jsonMapper.readTree(body);
        } catch (RestClientException | JacksonException e) {
            // 예외 메시지에 serviceKey가 든 요청 주소가 섞일 수 있어 종류만 남긴다
            throw new IllegalStateException("공공데이터포털 호출 실패: " + e.getClass().getSimpleName());
        }
        return checked(root);
    }

    // 키의 '+'·'/'·'='가 쿼리에서 다르게 읽히지 않게 값마다 직접 인코딩한다(UriBuilder는 '+'를 그대로 둠)
    private URI uri(Map<String, String> query) {
        String params = query.entrySet().stream()
                .map(e -> e.getKey() + "=" + URLEncoder.encode(e.getValue(), StandardCharsets.UTF_8))
                .collect(Collectors.joining("&"));
        return URI.create(properties.baseUrl() + DataGoKrPaths.STOCK_PRICE + "?" + params);
    }

    /** 포털 화면의 키가 인코딩된 모양(%)이면 %xx만 되돌린다. '+'는 키의 글자라 공백으로 바꾸지 않는다. */
    static String decodedKey(String raw) {
        String key = raw.trim();
        return key.contains("%") ? URLDecoder.decode(key.replace("+", "%2B"), StandardCharsets.UTF_8) : key;
    }

    /** 오류 응답이면 사유 코드로 실패한다. 정상이면 body. */
    private static JsonNode checked(JsonNode root) {
        JsonNode error = root.path("OpenAPI_ServiceResponse").path("cmmMsgHeader");
        if (!error.isMissingNode()) {
            throw new IllegalStateException("공공데이터포털 오류: " + error.path("returnReasonCode").asString("")
                    + " " + error.path("errMsg").asString(""));
        }
        JsonNode header = root.path("response").path("header");
        String code = header.path("resultCode").asString("");
        if (!"00".equals(code)) {
            throw new IllegalStateException("공공데이터포털 응답 코드: " + code + " " + header.path("resultMsg").asString(""));
        }
        return root.path("response").path("body");
    }

    private static void addKospi(List<StockPriceRow> rows, JsonNode item) {
        for (String field : REQUIRED_FIELDS) {
            if (item.path(field).isMissingNode()) {
                // 항목 이름이 바뀌면 조용히 빼지 않고 실패해 저장된 목록을 지킨다
                throw new IllegalStateException("공공데이터포털 응답 항목이 없습니다: " + field);
            }
        }
        if (!KOSPI.equals(item.path("mrktCtg").asString(""))) {
            return;
        }
        String stockCode = item.path("srtnCd").asString("").trim();
        if (stockCode.length() == 7 && stockCode.charAt(0) == 'A') {
            stockCode = stockCode.substring(1);
        }
        LocalDate date;
        long marketCap;
        try {
            date = LocalDate.parse(item.path("basDt").asString(""), BASIC_DATE);
            marketCap = Long.parseLong(item.path("mrktTotAmt").asString("").trim());
        } catch (DateTimeParseException | NumberFormatException e) {
            return;
        }
        if (stockCode.isEmpty() || marketCap <= 0) {
            return;
        }
        rows.add(new StockPriceRow(date, stockCode, item.path("itmsNm").asString("").trim(), KOSPI, marketCap));
    }
}
