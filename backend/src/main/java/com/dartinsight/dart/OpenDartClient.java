package com.dartinsight.dart;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
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
