package com.dartinsight.dart.client;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.dart.client.FakeOpenDartServer.Response;
import com.dartinsight.dart.client.OpenDartClient.DocumentFile;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class OpenDartClientDocumentTest {

    private static final String KEY = "test-key-not-real";
    private static final String PATH = "/api/document.xml";

    private FakeOpenDartServer server;
    private OpenDartClient client;

    @BeforeEach
    void setUp() throws IOException {
        server = new FakeOpenDartServer();
        client = new OpenDartClient(server.properties(KEY));
    }

    @AfterEach
    void tearDown() {
        server.close();
    }

    static byte[] zip(String name, String content) {
        try (ByteArrayOutputStream bytes = new ByteArrayOutputStream(); ZipOutputStream out = new ZipOutputStream(bytes)) {
            out.putNextEntry(new ZipEntry(name));
            out.write(content.getBytes(StandardCharsets.UTF_8));
            out.closeEntry();
            out.finish();
            return bytes.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    @Test
    void returnsTheZipOfTheReceiptNumber() {
        byte[] zip = zip("20260814000001.xml", "<DOCUMENT/>");
        server.on(PATH, Response.zip(zip));

        DocumentFile file = client.downloadDocument("20260814000001");

        assertThat(file.available()).isTrue();
        assertThat(file.zip()).isEqualTo(zip);
        assertThat(server.requests().getFirst()).contains("rcept_no=20260814000001");
    }

    @Test
    void missingFileIsNotAnError() {
        server.on(PATH, Response.xml("<result><status>014</status><message>파일이 존재하지 않습니다</message></result>"));

        DocumentFile file = client.downloadDocument("20260814000001");

        assertThat(file.available()).isFalse();
        assertThat(file.status()).isEqualTo("014");
        assertThat(file.message()).isEqualTo("파일이 존재하지 않습니다");
    }

    @Test
    void noDataInJsonIsNotAnError() {
        server.on(PATH, Response.json("{\"status\":\"013\",\"message\":\"조회된 데이타가 없습니다.\"}"));

        assertThat(client.downloadDocument("20260814000001").available()).isFalse();
    }

    @Test
    void rateLimitIsAnErrorWithoutTheKey() {
        server.on(PATH, Response.xml("<result><status>020</status><message>요청 제한을 초과하였습니다.</message></result>"));

        assertThatThrownBy(() -> client.downloadDocument("20260814000001"))
                .isInstanceOfSatisfying(ApiException.class,
                        e -> assertThat(e.errorCode()).isEqualTo(ErrorCode.DART_RATE_LIMITED))
                .message().doesNotContain(KEY);
    }

    @Test
    void unreadableAnswerIsARequestFailure() {
        server.on(PATH, Response.json("not json"));

        assertThatThrownBy(() -> client.downloadDocument("20260814000001"))
                .isInstanceOfSatisfying(ApiException.class,
                        e -> assertThat(e.errorCode()).isEqualTo(ErrorCode.DART_REQUEST_FAILED));
    }
}
