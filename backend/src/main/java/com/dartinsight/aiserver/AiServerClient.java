package com.dartinsight.aiserver;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.common.trace.TraceContext;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

/**
 * Spring Boot → FastAPI 내부 호출(/internal/**). 모든 요청에 X-Trace-Id를 넣고,
 * 응답이 없거나 오류면 정해진 시간 안에 {@link AiServerException}({@link ErrorCode#AI_SERVER_UNAVAILABLE})으로 끝낸다.
 */
@Component
public class AiServerClient {

    private static final Logger log = LoggerFactory.getLogger(AiServerClient.class);
    private static final Pattern ERROR_CODE = Pattern.compile("\"code\"\\s*:\\s*\"([A-Z_]+)\"");
    private static final Pattern ERROR_MESSAGE = Pattern.compile("\"message\"\\s*:\\s*\"((?:[^\"\\\\]|\\\\.)*)\"");

    private final RestClient restClient;
    private final RestClient healthClient;

    public AiServerClient(AiServerProperties properties) {
        this.restClient = build(properties, properties.readTimeout());
        this.healthClient = build(properties, properties.healthTimeout());
    }

    private static RestClient build(AiServerProperties properties, Duration readTimeout) {
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(properties.connectTimeout())
                .build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(readTimeout);

        return RestClient.builder()
                .baseUrl(properties.baseUrl())
                .requestFactory(requestFactory)
                .requestInterceptor((request, body, execution) -> {
                    String traceId = TraceContext.currentTraceId();
                    if (traceId != null) {
                        request.getHeaders().set(TraceContext.HEADER, traceId);
                    }
                    return execution.execute(request, body);
                })
                .build();
    }

    /** AI 서버 상태. 상태 확인 대기 시간(healthTimeout) 안에 응답이 없거나 오류면 DOWN. */
    public AiServerStatus health() {
        try {
            Map<?, ?> body = get(healthClient, AiServerPaths.HEALTH, Map.class);
            return body != null && "UP".equals(body.get("status")) ? AiServerStatus.UP : AiServerStatus.DOWN;
        } catch (ApiException e) {
            return AiServerStatus.DOWN;
        }
    }

    /** GET 요청. 실패하면 {@link AiServerException}. */
    public <T> T get(String path, Class<T> responseType) {
        return get(restClient, path, responseType);
    }

    /** 바이트 본문 POST(예: 원문 ZIP). 실패하면 {@link AiServerException}. */
    public <T> T postBytes(String path, byte[] body, MediaType contentType, Class<T> responseType) {
        try {
            return restClient.post().uri(path).contentType(contentType).body(body).retrieve().body(responseType);
        } catch (RestClientException e) {
            throw failure("POST", path, e);
        }
    }

    /** JSON 본문 POST. 실패하면 {@link AiServerException}. */
    public <T> T postJson(String path, Object body, Class<T> responseType) {
        try {
            return restClient.post().uri(path).contentType(MediaType.APPLICATION_JSON).body(body).retrieve()
                    .body(responseType);
        } catch (RestClientException e) {
            throw failure("POST", path, e);
        }
    }

    private static <T> T get(RestClient client, String path, Class<T> responseType) {
        try {
            return client.get().uri(path).retrieve().body(responseType);
        } catch (RestClientException e) {
            throw failure("GET", path, e);
        }
    }

    /** AI 서버가 에러 형식으로 답했으면 그 code와 message를 담는다. */
    private static AiServerException failure(String method, String path, RestClientException e) {
        String remoteCode = null;
        String message = ErrorCode.AI_SERVER_UNAVAILABLE.defaultMessage();
        if (e instanceof RestClientResponseException response) {
            // AI 서버(FastAPI)는 charset 없이 application/json으로 UTF-8을 보낸다. 기본값(ISO-8859-1)으로 읽지 않는다
            String body = response.getResponseBodyAsString(StandardCharsets.UTF_8);
            Matcher code = ERROR_CODE.matcher(body);
            Matcher text = ERROR_MESSAGE.matcher(body);
            if (code.find()) {
                remoteCode = code.group(1);
            }
            if (text.find()) {
                message = unescape(text.group(1));
            }
        }
        log.warn("AI 서버 호출 실패: {} {} ({}{})", method, path, remoteCode == null ? "" : remoteCode + " ",
                e.getMessage());
        return new AiServerException(remoteCode, message, e);
    }

    /** JSON 문자열 이스케이프(따옴표, 역슬래시, 줄바꿈, 유니코드 이스케이프 등)를 푼다. */
    static String unescape(String value) {
        StringBuilder out = new StringBuilder(value.length());
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (c != '\\' || i + 1 >= value.length()) {
                out.append(c);
                continue;
            }
            char next = value.charAt(++i);
            switch (next) {
                case 'n' -> out.append('\n');
                case 't' -> out.append('\t');
                case 'r' -> out.append('\r');
                case 'b' -> out.append('\b');
                case 'f' -> out.append('\f');
                case 'u' -> {
                    if (i + 4 < value.length()) {
                        try {
                            out.append((char) Integer.parseInt(value.substring(i + 1, i + 5), 16));
                            i += 4;
                        } catch (NumberFormatException e) {
                            out.append('u');
                        }
                    } else {
                        out.append('u');
                    }
                }
                default -> out.append(next);
            }
        }
        return out.toString();
    }

    public enum AiServerStatus {
        UP, DOWN
    }
}
