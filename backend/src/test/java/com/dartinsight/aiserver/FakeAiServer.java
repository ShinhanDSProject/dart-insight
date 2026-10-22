package com.dartinsight.aiserver;

import com.dartinsight.common.trace.TraceContext;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Function;

/** 테스트용 가짜 AI 서버. 경로별 응답을 정하고, 받은 요청(경로·본문·추적 ID)을 기록한다. */
public class FakeAiServer implements AutoCloseable {

    public record Request(String method, String path, byte[] body, String traceId) {

        public String bodyText() {
            return new String(body, StandardCharsets.UTF_8);
        }
    }

    public record Reply(int status, String json) {

        public static Reply ok(String json) {
            return new Reply(200, json);
        }

        public static Reply error(int status, String code, String message) {
            return new Reply(status, "{\"code\":\"" + code + "\",\"message\":\"" + message
                    + "\",\"traceId\":\"t\",\"errors\":[]}");
        }
    }

    private final HttpServer server;
    private final Map<String, Function<Request, Reply>> handlers = new ConcurrentHashMap<>();
    private final List<Request> requests = new CopyOnWriteArrayList<>();

    public FakeAiServer() {
        try {
            server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        server.createContext("/", this::handle);
        server.start();
    }

    public FakeAiServer on(String path, Function<Request, Reply> handler) {
        handlers.put(path, handler);
        return this;
    }

    public FakeAiServer on(String path, Reply reply) {
        return on(path, r -> reply);
    }

    public String baseUrl() {
        return "http://127.0.0.1:" + server.getAddress().getPort();
    }

    public List<Request> requests(String path) {
        return new ArrayList<>(requests.stream().filter(r -> r.path().equals(path)).toList());
    }

    public void clear() {
        handlers.clear();
        requests.clear();
    }

    private void handle(HttpExchange exchange) throws IOException {
        String path = exchange.getRequestURI().getPath();
        Request request = new Request(exchange.getRequestMethod(), path, exchange.getRequestBody().readAllBytes(),
                exchange.getRequestHeaders().getFirst(TraceContext.HEADER));
        requests.add(request);
        Function<Request, Reply> handler = handlers.get(path);
        Reply reply = handler == null ? Reply.error(404, "COMMON_NOT_FOUND", "없음") : handler.apply(request);
        byte[] bytes = reply.json().getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(reply.status(), bytes.length);
        try (OutputStream out = exchange.getResponseBody()) {
            out.write(bytes);
        }
        exchange.close();
    }

    @Override
    public void close() {
        server.stop(0);
    }
}
