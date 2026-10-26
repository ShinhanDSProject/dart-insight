package com.dartinsight.dart.client;

import static com.dartinsight.dart.client.DisclosureListJson.item;
import static com.dartinsight.dart.client.DisclosureListJson.page;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.dart.client.FakeOpenDartServer.Response;
import com.dartinsight.dart.dto.DisclosureListResponse;
import java.io.IOException;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class OpenDartClientListTest {

    private static final String KEY = "fake-key-for-test-0000000000000000000000";
    private static final LocalDate BEGIN = LocalDate.of(2015, 1, 1);
    private static final LocalDate END = LocalDate.of(2026, 10, 21);

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
    void readsAllPagesWithPeriodicAndLatestFilters() {
        server.on("/api/list.json",
                Response.json(page(1, 2, item("20260814000001", "반기보고서 (2026.06)", "20260814", ""))),
                Response.json(page(2, 2, item("20260515000001", "분기보고서 (2026.03)", "20260515", ""))));

        List<DisclosureListResponse.Item> items = new OpenDartClient(server.properties(KEY))
                .listPeriodicDisclosures("00000001", BEGIN, END);

        assertThat(items).extracting(DisclosureListResponse.Item::rceptNo)
                .containsExactly("20260814000001", "20260515000001");
        assertThat(items.get(0).reportName()).isEqualTo("반기보고서 (2026.06)");
        assertThat(server.requests()).hasSize(2);
        assertThat(server.requests().get(0))
                .contains("corp_code=00000001", "bgn_de=20150101", "end_de=20261021", "pblntf_ty=A",
                        "last_reprt_at=Y", "page_no=1", "page_count=100");
        assertThat(server.requests().get(1)).contains("page_no=2");
    }

    @Test
    @DisplayName("모든 공시유형 목록은 공시유형 없이 최종보고서만 받는다")
    void listsAllTypesWithoutPublicationTypeFilter() {
        server.on("/api/list.json",
                Response.json(page(1, 1, item("20261026000017", "임원ㆍ주요주주특정증권등소유상황보고서", "20261026", ""))));

        List<DisclosureListResponse.Item> items = new OpenDartClient(server.properties(KEY))
                .listAllDisclosures("00000001", LocalDate.of(2026, 7, 28), END);

        assertThat(items).extracting(DisclosureListResponse.Item::rceptNo).containsExactly("20261026000017");
        assertThat(server.requests().get(0))
                .contains("corp_code=00000001", "bgn_de=20260728", "end_de=20261021", "last_reprt_at=Y")
                .doesNotContain("pblntf_ty");
    }

    @Test
    void noDataIsEmptyList() {
        server.on("/api/list.json", Response.json(DisclosureListJson.NO_DATA));

        List<DisclosureListResponse.Item> items = new OpenDartClient(server.properties(KEY))
                .listPeriodicDisclosures("00000001", BEGIN, END);

        assertThat(items).isEmpty();
    }

    @Test
    void rateLimitBecomesDartRateLimited() {
        server.on("/api/list.json", Response.json(DisclosureListJson.RATE_LIMITED));

        assertThatThrownBy(() -> new OpenDartClient(server.properties(KEY))
                .listPeriodicDisclosures("00000001", BEGIN, END))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).errorCode())
                .isEqualTo(ErrorCode.DART_RATE_LIMITED);
    }

    @Test
    void missingKeyFailsBeforeCalling() {
        assertThatThrownBy(() -> new OpenDartClient(server.properties(""))
                .listPeriodicDisclosures("00000001", BEGIN, END))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).errorCode())
                .isEqualTo(ErrorCode.DART_KEY_MISSING);
        assertThat(server.requests()).isEmpty();
    }
}
