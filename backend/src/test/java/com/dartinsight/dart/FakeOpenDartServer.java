package com.dartinsight.dart;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * 테스트용 가짜 OpenDART 서버. 경로별로 응답을 순서대로 돌려주고, 받은 요청 주소를 기록한다.
 */
public class FakeOpenDartServer implements AutoCloseable {

    public record Response(int status, String contentType, byte[] body) {

        public static Response json(String json) {
            return new Response(200, "application/json;charset=UTF-8", json.getBytes(StandardCharsets.UTF_8));
        }

        public static Response xml(String xml) {
            return new Response(200, "application/xml;charset=UTF-8", xml.getBytes(StandardCharsets.UTF_8));
        }

        public static Response zip(byte[] zip) {
            return new Response(200, "application/x-msdownload", zip);
        }

        public static Response status(int status) {
            return new Response(status, "text/plain", new byte[0]);
        }
    }

    private final HttpServer server;
    private final Map<String, List<Response>> responses = new ConcurrentHashMap<>();
    private final List<String> requests = new CopyOnWriteArrayList<>();

    public FakeOpenDartServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", this::handle);
        server.start();
    }

    /** 같은 경로에 여러 번 부르면 등록한 순서대로, 마지막 응답은 계속 돌려준다. */
    public FakeOpenDartServer on(String path, Response... answers) {
        responses.put(path, new CopyOnWriteArrayList<>(List.of(answers)));
        return this;
    }

    public String baseUrl() {
        return "http://127.0.0.1:" + server.getAddress().getPort();
    }

    public List<String> requests() {
        return new ArrayList<>(requests);
    }

    public OpenDartProperties properties(String apiKey) {
        return new OpenDartProperties(apiKey, baseUrl(), Duration.ofSeconds(1), Duration.ofSeconds(2), 2,
                OpenDartProperties.CorpCodeSync.NEVER);
    }

    private void handle(HttpExchange exchange) throws IOException {
        String path = exchange.getRequestURI().getPath();
        requests.add(exchange.getRequestURI().toString());
        List<Response> queue = responses.get(path);
        Response response = queue == null || queue.isEmpty() ? Response.status(404)
                : queue.size() > 1 ? queue.remove(0) : queue.get(0);
        exchange.getResponseHeaders().set("Content-Type", response.contentType());
        exchange.sendResponseHeaders(response.status(), response.body().length == 0 ? -1 : response.body().length);
        if (response.body().length > 0) {
            try (OutputStream out = exchange.getResponseBody()) {
                out.write(response.body());
            }
        }
        exchange.close();
    }

    @Override
    public void close() {
        server.stop(0);
    }
}
