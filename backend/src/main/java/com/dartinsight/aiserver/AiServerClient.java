package com.dartinsight.aiserver;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.common.trace.TraceContext;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Spring Boot → FastAPI 내부 호출(/internal/**). 모든 요청에 X-Trace-Id를 넣고,
 * 응답이 없거나 오류면 정해진 시간 안에 {@link ErrorCode#AI_SERVER_UNAVAILABLE}로 끝낸다.
 */
@Component
public class AiServerClient {

    private static final Logger log = LoggerFactory.getLogger(AiServerClient.class);

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
            Map<?, ?> body = get(healthClient, "/internal/health", Map.class);
            return body != null && "UP".equals(body.get("status")) ? AiServerStatus.UP : AiServerStatus.DOWN;
        } catch (ApiException e) {
            return AiServerStatus.DOWN;
        }
    }

    /** GET 요청. 실패하면 AI_SERVER_UNAVAILABLE. */
    public <T> T get(String path, Class<T> responseType) {
        return get(restClient, path, responseType);
    }

    private static <T> T get(RestClient client, String path, Class<T> responseType) {
        try {
            return client.get().uri(path).retrieve().body(responseType);
        } catch (RestClientException e) {
            log.warn("AI 서버 호출 실패: GET {} ({})", path, e.getMessage());
            throw new ApiException(ErrorCode.AI_SERVER_UNAVAILABLE, ErrorCode.AI_SERVER_UNAVAILABLE.defaultMessage(),
                    e);
        }
    }

    public enum AiServerStatus {
        UP, DOWN
    }
}
