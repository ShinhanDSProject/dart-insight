package com.dartinsight.dart.client;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.dart.client.FakeOpenDartServer.Response;
import java.io.IOException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class OpenDartClientCorpCodeTest {

    private static final String KEY = "fake-key-for-test-0000000000000000000000";
    private FakeOpenDartServer server;

    @BeforeEach
    void setUp() throws IOException {
        server = new FakeOpenDartServer();
    }

    @AfterEach
    void tearDown() {
        server.close();
    }

    @Test
    void downloadsZipWithApiKey() throws IOException {
        byte[] zip = CorpCodeParserTest.zip("CORPCODE.xml", CorpCodeParserTest.SAMPLE_XML);
        server.on("/api/corpCode.xml", Response.zip(zip));

        byte[] body = new OpenDartClient(server.properties(KEY)).downloadCorpCodes();

        assertThat(body).isEqualTo(zip);
        assertThat(server.requests()).singleElement().asString().contains("crtfc_key=" + KEY);
    }

    @Test
    void rateLimitBecomesDartRateLimited() {
        server.on("/api/corpCode.xml", Response.xml(
                "<?xml version=\"1.0\"?><result><status>020</status><message>요청 제한을 초과하였습니다.</message></result>"));

        assertThatThrownBy(() -> new OpenDartClient(server.properties(KEY)).downloadCorpCodes())
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).errorCode())
                .isEqualTo(ErrorCode.DART_RATE_LIMITED);
    }

    @Test
    void invalidKeyBecomesRequestFailedWithoutLeakingKey() {
        server.on("/api/corpCode.xml", Response.xml(
                "<?xml version=\"1.0\"?><result><status>010</status><message>등록되지 않은 키입니다.</message></result>"));

        assertThatThrownBy(() -> new OpenDartClient(server.properties(KEY)).downloadCorpCodes())
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("010")
                .hasMessageNotContaining(KEY)
                .extracting(e -> ((ApiException) e).errorCode())
                .isEqualTo(ErrorCode.DART_REQUEST_FAILED);
    }

    @Test
    void missingKeyFailsBeforeCalling() {
        assertThatThrownBy(() -> new OpenDartClient(server.properties("")).downloadCorpCodes())
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).errorCode())
                .isEqualTo(ErrorCode.DART_KEY_MISSING);
        assertThat(server.requests()).isEmpty();
    }

    @Test
    void serverErrorIsRetried() throws IOException {
        byte[] zip = CorpCodeParserTest.zip("CORPCODE.xml", CorpCodeParserTest.SAMPLE_XML);
        server.on("/api/corpCode.xml", Response.status(503), Response.zip(zip));

        byte[] body = new OpenDartClient(server.properties(KEY)).downloadCorpCodes();

        assertThat(body).isEqualTo(zip);
        assertThat(server.requests()).hasSize(2);
    }

    @Test
    void givesUpAfterMaxRetries() {
        server.on("/api/corpCode.xml", Response.status(500));

        assertThatThrownBy(() -> new OpenDartClient(server.properties(KEY)).downloadCorpCodes())
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).errorCode())
                .isEqualTo(ErrorCode.DART_REQUEST_FAILED);
        assertThat(server.requests()).hasSize(3);
    }
}
