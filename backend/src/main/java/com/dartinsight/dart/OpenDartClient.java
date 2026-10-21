package com.dartinsight.dart;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Supplier;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * OpenDART 호출. 인증키는 요청 주소에만 넣고 로그·에러 메시지에는 남기지 않는다.
 * 응답 본문의 status를 확인해 오류를 정해진 에러 코드로 바꾼다.
 */
@Component
public class OpenDartClient {

    private static final Logger log = LoggerFactory.getLogger(OpenDartClient.class);
    private static final Pattern XML_STATUS = Pattern.compile("<status>\\s*(\\d+)\\s*</status>");
    private static final Pattern XML_MESSAGE = Pattern.compile("<message>(.*?)</message>", Pattern.DOTALL);
    static final String OK = "000";
    static final String NO_DATA = "013";
    private static final int PAGE_SIZE = 100;
    private static final int MAX_PAGES = 50;

    private final OpenDartProperties properties;
    private final RestClient restClient;

    public OpenDartClient(OpenDartProperties properties) {
        this.properties = properties;
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(properties.connectTimeout())
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(properties.readTimeout());
        this.restClient = RestClient.builder()
                .baseUrl(properties.baseUrl())
                .requestFactory(requestFactory)
                .build();
    }

    /** 고유번호 목록(corpCode.xml). ZIP 파일 그대로 돌려준다. */
    public byte[] downloadCorpCodes() {
        requireApiKey();
        byte[] body = execute("corpCode.xml", () -> restClient.get()
                .uri(uri -> uri.path("/api/corpCode.xml").queryParam("crtfc_key", properties.apiKey()).build())
                .retrieve()
                .body(byte[].class));
        if (body == null || !isZip(body)) {
            throw errorFromXml(body);
        }
        return body;
    }

    /**
     * 정기공시(pblntf_ty=A) 중 최종보고서(last_reprt_at=Y) 목록. 페이지를 끝까지 받는다.
     * 자료가 없으면(013) 빈 목록이다.
     */
    public List<DisclosureListResponse.Item> listPeriodicDisclosures(String corpCode, LocalDate begin, LocalDate end) {
        requireApiKey();
        List<DisclosureListResponse.Item> all = new ArrayList<>();
        for (int page = 1; page <= MAX_PAGES; page++) {
            int pageNo = page;
            DisclosureListResponse response = execute("list.json", () -> restClient.get()
                    .uri(uri -> uri.path("/api/list.json")
                            .queryParam("crtfc_key", properties.apiKey())
                            .queryParam("corp_code", corpCode)
                            .queryParam("bgn_de", begin.format(DateTimeFormatter.BASIC_ISO_DATE))
                            .queryParam("end_de", end.format(DateTimeFormatter.BASIC_ISO_DATE))
                            .queryParam("pblntf_ty", "A")
                            .queryParam("last_reprt_at", "Y")
                            .queryParam("page_no", pageNo)
                            .queryParam("page_count", PAGE_SIZE)
                            .build())
                    .retrieve()
                    .body(DisclosureListResponse.class));
            if (response == null) {
                throw new ApiException(ErrorCode.DART_REQUEST_FAILED, "OpenDART 응답이 비어 있습니다.");
            }
            if (NO_DATA.equals(response.status())) {
                return all;
            }
            if (!OK.equals(response.status())) {
                throw statusError(response.status(), response.message());
            }
            if (response.list() != null) {
                all.addAll(response.list());
            }
            int totalPage = response.totalPage() == null ? 1 : response.totalPage();
            if (page >= totalPage) {
                break;
            }
            if (page == MAX_PAGES) {
                log.warn("공시 목록이 {}페이지를 넘어 앞의 {}페이지만 받았습니다: {} (전체 {}페이지)", MAX_PAGES, MAX_PAGES,
                        corpCode, totalPage);
            }
        }
        return all;
    }

    void requireApiKey() {
        if (!properties.hasApiKey()) {
            throw new ApiException(ErrorCode.DART_KEY_MISSING);
        }
    }

    /** 네트워크 오류와 5xx는 정해진 횟수만큼 다시 시도한다. */
    <T> T execute(String name, Supplier<T> call) {
        int attempt = 0;
        while (true) {
            try {
                return call.get();
            } catch (ResourceAccessException | HttpServerErrorException e) {
                attempt++;
                if (attempt > properties.maxRetries()) {
                    log.warn("OpenDART {} 호출 실패({}회 시도): {}", name, attempt, mask(e.getMessage()));
                    throw new ApiException(ErrorCode.DART_REQUEST_FAILED);
                }
                log.info("OpenDART {} 호출 재시도 {}/{}", name, attempt, properties.maxRetries());
                sleep(500L * attempt);
            } catch (RestClientException e) {
                log.warn("OpenDART {} 호출 실패: {}", name, mask(e.getMessage()));
                throw new ApiException(ErrorCode.DART_REQUEST_FAILED);
            }
        }
    }

    /**
     * OpenDART 상태 코드를 에러로 바꾼다. 000(정상)과 013(자료 없음)은 호출한 쪽에서 처리한다.
     */
    static ApiException statusError(String status, String message) {
        String detail = "OpenDART 응답 오류(" + status + "): " + (message == null ? "" : message);
        if ("020".equals(status)) {
            return new ApiException(ErrorCode.DART_RATE_LIMITED, ErrorCode.DART_RATE_LIMITED.defaultMessage());
        }
        return new ApiException(ErrorCode.DART_REQUEST_FAILED, detail);
    }

    private ApiException errorFromXml(byte[] body) {
        String text = body == null ? "" : new String(body, StandardCharsets.UTF_8);
        Matcher status = XML_STATUS.matcher(text);
        Matcher message = XML_MESSAGE.matcher(text);
        if (status.find()) {
            return statusError(status.group(1), message.find() ? message.group(1).trim() : null);
        }
        return new ApiException(ErrorCode.DART_REQUEST_FAILED, "OpenDART 응답을 읽을 수 없습니다.");
    }

    private static boolean isZip(byte[] body) {
        return body.length >= 4 && body[0] == 'P' && body[1] == 'K' && body[2] == 3 && body[3] == 4;
    }

    /** 로그에 인증키가 남지 않게 가린다. */
    String mask(String text) {
        if (text == null || !properties.hasApiKey()) {
            return text;
        }
        return text.replace(properties.apiKey(), "***");
    }

    private static void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ApiException(ErrorCode.DART_REQUEST_FAILED);
        }
    }
}
