package com.dartinsight.aiserver;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.dartinsight.aiserver.AiServerClient.AiServerStatus;
import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.common.trace.TraceContext;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;

/** 가짜 AI 서버(JDK HttpServer)를 띄워 내부 호출을 확인한다. */
class AiServerClientTest {

    private HttpServer server;
    private final AtomicReference<String> receivedTraceId = new AtomicReference<>();
    private volatile int status = 200;
    private volatile String body = "{\"status\":\"UP\"}";
    private volatile long delayMillis = 0;

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/internal/health", exchange -> {
            receivedTraceId.set(exchange.getRequestHeaders().getFirst(TraceContext.HEADER));
            try {
                Thread.sleep(delayMillis);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(status, bytes.length);
            try (OutputStream out = exchange.getResponseBody()) {
                out.write(bytes);
            }
        });
        server.start();
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
        MDC.clear();
    }

    private AiServerClient client(Duration readTimeout) {
        String baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
        return new AiServerClient(new AiServerProperties(baseUrl, Duration.ofSeconds(1), readTimeout, readTimeout));
    }

    @Test
    void healthIsUpAndTraceIdIsForwarded() {
        MDC.put(TraceContext.MDC_KEY, "trace-from-request");

        AiServerStatus result = client(Duration.ofSeconds(2)).health();

        assertThat(result).isEqualTo(AiServerStatus.UP);
        assertThat(receivedTraceId.get()).isEqualTo("trace-from-request");
    }

    @Test
    void serverErrorMeansDown() {
        status = 500;
        body = "{\"code\":\"COMMON_INTERNAL_ERROR\"}";

        assertThat(client(Duration.ofSeconds(2)).health()).isEqualTo(AiServerStatus.DOWN);
    }

    @Test
    void slowServerFailsWithinReadTimeout() {
        delayMillis = 3000;
        long started = System.nanoTime();

        assertThatThrownBy(() -> client(Duration.ofMillis(300)).get("/internal/health", Map.class))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).errorCode())
                .isEqualTo(ErrorCode.AI_SERVER_UNAVAILABLE);

        long elapsedMillis = (System.nanoTime() - started) / 1_000_000;
        assertThat(elapsedMillis).isLessThan(2000);
    }

    @Test
    void slowHealthIsDownWithinHealthTimeout() {
        delayMillis = 3000;
        String baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
        AiServerClient client = new AiServerClient(new AiServerProperties(baseUrl, Duration.ofSeconds(1),
                Duration.ofSeconds(30), Duration.ofMillis(300)));
        long started = System.nanoTime();

        assertThat(client.health()).isEqualTo(AiServerStatus.DOWN);
        assertThat((System.nanoTime() - started) / 1_000_000).isLessThan(2000);
    }

    @Test
    void unreachableServerMeansDown() {
        int port = server.getAddress().getPort();
        server.stop(0);
        AiServerClient client = new AiServerClient(new AiServerProperties(
                "http://127.0.0.1:" + port, Duration.ofMillis(500), Duration.ofMillis(500), Duration.ofMillis(500)));

        assertThat(client.health()).isEqualTo(AiServerStatus.DOWN);
    }
}
