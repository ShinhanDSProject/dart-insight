package com.dartinsight.relateddisclosure.service;

import static com.dartinsight.dart.client.DisclosureListJson.item;
import static com.dartinsight.dart.client.DisclosureListJson.page;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.company.service.CompanyImportService;
import com.dartinsight.dart.client.DisclosureListJson;
import com.dartinsight.dart.client.FakeOpenDartServer;
import com.dartinsight.dart.client.FakeOpenDartServer.Response;
import com.dartinsight.dart.domain.CorpCodeEntry;
import com.dartinsight.relateddisclosure.domain.DisclosureDetailType;
import com.dartinsight.relateddisclosure.domain.DisclosureWindow;
import com.dartinsight.relateddisclosure.domain.WindowDisclosure;
import com.dartinsight.relateddisclosure.domain.WindowDisclosures;
import com.dartinsight.relateddisclosure.domain.WindowFetchStatus;
import com.dartinsight.support.TestData;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

@SpringBootTest
class DisclosureWindowServiceTest {

    private static final FakeOpenDartServer SERVER = startServer();
    private static final String LIST = "/api/list.json";
    private static final DisclosureWindow WINDOW = new DisclosureWindow("00000001", LocalDate.of(2025, 6, 30),
            LocalDate.of(2026, 6, 30), LocalDate.of(2026, 8, 14));

    @DynamicPropertySource
    static void openDart(DynamicPropertyRegistry registry) {
        registry.add("app.opendart.base-url", SERVER::baseUrl);
        registry.add("app.opendart.read-timeout", () -> "2s");
        registry.add("app.opendart.max-retries", () -> "0");
    }

    private static FakeOpenDartServer startServer() {
        try {
            return new FakeOpenDartServer();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    @Autowired
    private DisclosureWindowService service;

    @Autowired
    private CompanyImportService companyImportService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        TestData.clearAll(jdbcTemplate);
        companyImportService.save(List.of(
                new CorpCodeEntry("00000001", "예시전자", null, "900001", LocalDate.of(2026, 1, 1))));
    }

    private int requestCount() {
        return SERVER.requests().size();
    }

    private List<String> requestsSince(int before) {
        List<String> all = SERVER.requests();
        return all.subList(before, all.size());
    }

    private int count(String table) {
        Integer n = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM " + table, Integer.class);
        return n == null ? 0 : n;
    }

    @Test
    @DisplayName("상세유형 세 개를 정정 전 원본까지 받아 접수일 순서로 저장한다")
    void fetchesThreeDetailTypesWithOriginalsAndSaves() {
        String otherCompany = """
                {"corp_code":"00000009","corp_name":"다른회사","report_nm":"주요사항보고서(소송등의제기)",
                 "rcept_no":"20260701000009","flr_nm":"다른회사","rcept_dt":"20260701","rm":""}
                """;
        SERVER.on(LIST,
                Response.json(page(1, 1,
                        item("20261013000198", "[기재정정]주요사항보고서(유상증자결정)", "20261013", ""),
                        item("20260630000676", "주요사항보고서(유상증자결정)", "20260630", "정"))),
                Response.json(page(1, 1,
                        item("20260115000010", "  타법인주식및출자증권취득결정  ", "20260115", "유"),
                        otherCompany)),
                Response.json(DisclosureListJson.NO_DATA));
        int before = requestCount();

        WindowDisclosures result = service.load(WINDOW);

        List<String> requests = requestsSince(before);
        assertThat(requests).hasSize(3);
        assertThat(requests.get(0)).contains("pblntf_detail_ty=B001", "last_reprt_at=N", "bgn_de=20250630",
                "end_de=20260814");
        assertThat(requests.get(1)).contains("pblntf_detail_ty=I001");
        assertThat(requests.get(2)).contains("pblntf_detail_ty=I002");

        assertThat(result.fetch().status()).isEqualTo(WindowFetchStatus.OK);
        assertThat(result.fetch().beginDate()).isEqualTo(LocalDate.of(2025, 6, 30));
        assertThat(result.fetch().endDate()).isEqualTo(LocalDate.of(2026, 8, 14));
        assertThat(result.items()).extracting(WindowDisclosure::rceptNo)
                .containsExactly("20260115000010", "20260630000676", "20261013000198");
        WindowDisclosure first = result.items().get(0);
        assertThat(first.detailType()).isEqualTo(DisclosureDetailType.I001);
        assertThat(first.reportName()).isEqualTo("타법인주식및출자증권취득결정");
        assertThat(first.remark()).isEqualTo("유");
        WindowDisclosure original = result.items().get(1);
        assertThat(original.detailType()).isEqualTo(DisclosureDetailType.B001);
        assertThat(original.remark()).isEqualTo("정");
        assertThat(result.items().get(2).remark()).isNull();
        assertThat(count("disclosure_window_fetch")).isEqualTo(1);
        assertThat(count("disclosure_window_item")).isEqualTo(3);
    }

    @Test
    @DisplayName("같은 기업·기간을 다시 부르면 OpenDART를 부르지 않고 저장된 목록을 준다")
    void savedWindowIsNotFetchedAgain() {
        SERVER.on(LIST, Response.json(page(1, 1,
                item("20260630000676", "주요사항보고서(유상증자결정)", "20260630", "정"))));
        service.load(WINDOW);
        int before = requestCount();

        WindowDisclosures again = service.load(WINDOW);

        assertThat(requestsSince(before)).isEmpty();
        assertThat(again.items()).extracting(WindowDisclosure::rceptNo).containsExactly("20260630000676");
    }

    @Test
    @DisplayName("기간이 다르면 따로 받는다")
    void differentWindowIsFetchedSeparately() {
        SERVER.on(LIST, Response.json(DisclosureListJson.NO_DATA));
        service.load(WINDOW);
        int before = requestCount();

        service.load(new DisclosureWindow("00000001", LocalDate.of(2024, 6, 30), LocalDate.of(2025, 6, 30),
                LocalDate.of(2025, 8, 14)));

        assertThat(requestsSince(before)).hasSize(3);
        assertThat(count("disclosure_window_fetch")).isEqualTo(2);
    }

    @Test
    @DisplayName("세 상세유형 모두 013이면 '자료 없음'으로 저장하고 다시 부르지 않는다")
    void noDataIsSavedAndNotFetchedAgain() {
        SERVER.on(LIST, Response.json(DisclosureListJson.NO_DATA));

        WindowDisclosures result = service.load(WINDOW);
        int before = requestCount();
        WindowDisclosures again = service.load(WINDOW);

        assertThat(result.fetch().status()).isEqualTo(WindowFetchStatus.NO_DATA);
        assertThat(result.items()).isEmpty();
        assertThat(again.fetch().status()).isEqualTo(WindowFetchStatus.NO_DATA);
        assertThat(requestsSince(before)).isEmpty();
    }

    @Test
    @DisplayName("020(요청 제한)이면 DART_RATE_LIMITED로 실패하고 저장하지 않는다")
    void rateLimitFailsWithoutSaving() {
        SERVER.on(LIST, Response.json(DisclosureListJson.RATE_LIMITED));

        assertThatThrownBy(() -> service.load(WINDOW))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).errorCode())
                .isEqualTo(ErrorCode.DART_RATE_LIMITED);
        assertThat(count("disclosure_window_fetch")).isZero();
    }

    @Test
    @DisplayName("800(시스템 점검)이면 DART_REQUEST_FAILED로 실패하고 저장하지 않는다")
    void maintenanceFailsWithoutSaving() {
        SERVER.on(LIST, Response.json("{\"status\":\"800\",\"message\":\"시스템 점검으로 인한 서비스가 중지 중입니다.\"}"));

        assertThatThrownBy(() -> service.load(WINDOW))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).errorCode())
                .isEqualTo(ErrorCode.DART_REQUEST_FAILED);
        assertThat(count("disclosure_window_fetch")).isZero();
    }

    @Test
    @DisplayName("한 상세유형이라도 실패하면 앞에서 받은 것도 저장하지 않고, 다음 요청에서 다시 받는다")
    void partialFailureSavesNothingAndRetriesNextTime() {
        SERVER.on(LIST,
                Response.json(page(1, 1, item("20260630000676", "주요사항보고서(유상증자결정)", "20260630", "정"))),
                Response.json(DisclosureListJson.RATE_LIMITED));

        assertThatThrownBy(() -> service.load(WINDOW)).isInstanceOf(ApiException.class);
        assertThat(count("disclosure_window_fetch")).isZero();
        assertThat(count("disclosure_window_item")).isZero();

        SERVER.on(LIST, Response.json(DisclosureListJson.NO_DATA));
        int before = requestCount();
        WindowDisclosures retried = service.load(WINDOW);

        assertThat(requestsSince(before)).hasSize(3);
        assertThat(retried.fetch().status()).isEqualTo(WindowFetchStatus.NO_DATA);
    }
}
