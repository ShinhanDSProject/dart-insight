package com.dartinsight.dart;

import static com.dartinsight.dart.FinancialJson.account;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.dart.FakeOpenDartServer.Response;
import java.io.IOException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class OpenDartClientFinancialTest {

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
    void readsAccountsWithRequestedKeys() {
        server.on("/api/fnlttSinglAcntAll.json", Response.json(FinancialJson.ok(
                account("20260814000001", "BS", "ifrs-full_Assets", "자산총계", 1, "1000", "", "900"))));

        OpenDartClient.FinancialStatementPage page = new OpenDartClient(server.properties(KEY))
                .financialStatements("00000001", 2026, "11012", "CFS");

        assertThat(page.noData()).isFalse();
        assertThat(page.items()).singleElement().satisfies(item -> {
            assertThat(item.rceptNo()).isEqualTo("20260814000001");
            assertThat(item.sjDiv()).isEqualTo("BS");
            assertThat(item.accountId()).isEqualTo("ifrs-full_Assets");
            assertThat(item.accountName()).isEqualTo("자산총계");
            assertThat(item.thstrmAmount()).isEqualTo("1000");
            assertThat(item.frmtrmAmount()).isEqualTo("900");
            assertThat(item.ord()).isEqualTo("1");
            assertThat(item.currency()).isEqualTo("KRW");
        });
        assertThat(server.requests()).singleElement().asString()
                .contains("corp_code=00000001", "bsns_year=2026", "reprt_code=11012", "fs_div=CFS");
    }

    @Test
    void noDataIsNotAFailure() {
        server.on("/api/fnlttSinglAcntAll.json", Response.json(FinancialJson.NO_DATA));

        OpenDartClient.FinancialStatementPage page = new OpenDartClient(server.properties(KEY))
                .financialStatements("00000001", 2026, "11012", "CFS");

        assertThat(page.noData()).isTrue();
        assertThat(page.items()).isEmpty();
    }

    @Test
    void rateLimitIsAnError() {
        server.on("/api/fnlttSinglAcntAll.json", Response.json(FinancialJson.RATE_LIMITED));

        assertThatThrownBy(() -> new OpenDartClient(server.properties(KEY))
                .financialStatements("00000001", 2026, "11012", "CFS"))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).errorCode())
                .isEqualTo(ErrorCode.DART_RATE_LIMITED);
    }
}
