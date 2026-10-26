package com.dartinsight.disclosure.controller;

import static com.dartinsight.dart.client.DisclosureListJson.item;
import static com.dartinsight.dart.client.DisclosureListJson.page;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.matchesPattern;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dartinsight.company.service.CompanyImportService;
import com.dartinsight.dart.client.DisclosureListJson;
import com.dartinsight.dart.client.FakeOpenDartServer;
import com.dartinsight.dart.client.FakeOpenDartServer.Response;
import com.dartinsight.dart.domain.CorpCodeEntry;
import com.dartinsight.support.TestData;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class CompanyDisclosureControllerTest {

    private static final FakeOpenDartServer SERVER = startServer();
    private static final String PATH = "/api/companies/00000001/disclosures";

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
    private MockMvc mockMvc;

    @Autowired
    private CompanyImportService companyImportService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private Clock clock;

    private LocalDate today;

    @BeforeEach
    void setUp() {
        TestData.clearAll(jdbcTemplate);
        companyImportService.save(List.of(
                new CorpCodeEntry("00000001", "예시전자", null, "900001", LocalDate.of(2026, 1, 1))));
        today = LocalDate.now(clock);
    }

    private String daysAgo(int days) {
        return today.minusDays(days).format(DateTimeFormatter.BASIC_ISO_DATE);
    }

    private String iso(int daysAgo) {
        return today.minusDays(daysAgo).toString();
    }

    private void answer(String... items) {
        SERVER.on("/api/list.json", Response.json(page(1, 1, items)));
    }

    private long listCalls() {
        return SERVER.requests().stream().filter(r -> r.startsWith("/api/list.json")).count();
    }

    private void makeStale() {
        jdbcTemplate.update("UPDATE company_disclosure_fetch SET fetched_at = ? WHERE corp_code = '00000001'",
                Timestamp.valueOf(LocalDateTime.now(clock).minusHours(2)));
    }

    @Test
    @DisplayName("최근 공시를 접수일이 최근인 순서로 묶음·근거 링크와 함께 돌려준다")
    void listsNewestFirstWithGroupsAndLinks() throws Exception {
        answer(item("20260814000001", "반기보고서 (2026.06)", daysAgo(70), "유"),
                item("20261020000001", "임원ㆍ주요주주특정증권등소유상황보고서", daysAgo(3), ""),
                item("20261020000002", "[기재정정]연결재무제표기준영업(잠정)실적(공정공시)              ", daysAgo(3), "유"),
                item("20261001000001", "주요사항보고서(유상증자결정)", daysAgo(20), ""));

        mockMvc.perform(get(PATH))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.corpCode").value("00000001"))
                .andExpect(jsonPath("$.days").value(90))
                .andExpect(jsonPath("$.from").value(iso(90)))
                .andExpect(jsonPath("$.to").value(iso(0)))
                .andExpect(jsonPath("$.fetchedAt").value(matchesPattern("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}")))
                .andExpect(jsonPath("$.refreshError").value(nullValue()))
                .andExpect(jsonPath("$.groups", hasSize(6)))
                .andExpect(jsonPath("$.groups[0].group").value("PERIODIC"))
                .andExpect(jsonPath("$.groups[0].label").value("정기보고서"))
                .andExpect(jsonPath("$.groups[0].count").value(1))
                .andExpect(jsonPath("$.groups[1].group").value("OWNERSHIP"))
                .andExpect(jsonPath("$.groups[1].count").value(1))
                .andExpect(jsonPath("$.groups[2].group").value("FUNDING"))
                .andExpect(jsonPath("$.groups[2].count").value(1))
                .andExpect(jsonPath("$.groups[3].group").value("GOVERNANCE"))
                .andExpect(jsonPath("$.groups[3].count").value(0))
                .andExpect(jsonPath("$.groups[4].group").value("BUSINESS"))
                .andExpect(jsonPath("$.groups[4].label").value("실적·영업"))
                .andExpect(jsonPath("$.groups[4].count").value(1))
                .andExpect(jsonPath("$.groups[5].group").value("OTHER"))
                .andExpect(jsonPath("$.groups[5].count").value(0))
                .andExpect(jsonPath("$.items", hasSize(4)))
                .andExpect(jsonPath("$.items[0].rceptNo").value("20261020000002"))
                .andExpect(jsonPath("$.items[0].reportName").value("[기재정정]연결재무제표기준영업(잠정)실적(공정공시)"))
                .andExpect(jsonPath("$.items[0].group").value("BUSINESS"))
                .andExpect(jsonPath("$.items[0].remarks").value("유"))
                .andExpect(jsonPath("$.items[1].rceptNo").value("20261020000001"))
                .andExpect(jsonPath("$.items[1].remarks").value(nullValue()))
                .andExpect(jsonPath("$.items[2].rceptNo").value("20261001000001"))
                .andExpect(jsonPath("$.items[3].rceptNo").value("20260814000001"))
                .andExpect(jsonPath("$.items[3].reportName").value("반기보고서 (2026.06)"))
                .andExpect(jsonPath("$.items[3].filerName").value("예시전자"))
                .andExpect(jsonPath("$.items[3].receivedDate").value(iso(70)))
                .andExpect(jsonPath("$.items[3].group").value("PERIODIC"))
                .andExpect(jsonPath("$.items[3].groupLabel").value("정기보고서"))
                .andExpect(jsonPath("$.items[3].periodic").value(true))
                .andExpect(jsonPath("$.items[3].dartUrl")
                        .value("https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260814000001"))
                .andExpect(jsonPath("$.items[1].periodic").value(false))
                // 핵심 수치(FS-51)는 지원하는 주요사항보고서에만
                .andExpect(jsonPath("$.items[2].keyItemsKind").value("CAPITAL_INCREASE"))
                .andExpect(jsonPath("$.items[1].keyItemsKind").value(nullValue()))
                .andExpect(jsonPath("$.items[3].keyItemsKind").value(nullValue()));

        String request = SERVER.requests().get(SERVER.requests().size() - 1);
        assertThat(request).contains("corp_code=00000001", "bgn_de=" + daysAgo(90), "end_de=" + daysAgo(0),
                "last_reprt_at=Y").doesNotContain("pblntf_ty");
    }

    @Test
    @DisplayName("정한 시간 안에는 OpenDART를 다시 부르지 않고, 지나면 다시 받는다")
    void usesCacheWithinRefreshTime() throws Exception {
        answer(item("20261020000001", "최대주주변경", daysAgo(3), ""));
        mockMvc.perform(get(PATH)).andExpect(status().isOk());
        long calls = listCalls();

        answer(item("20261026000001", "대표이사변경", daysAgo(0), ""));
        mockMvc.perform(get(PATH))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].rceptNo").value("20261020000001"));
        mockMvc.perform(get(PATH).param("days", "30")).andExpect(status().isOk());
        assertThat(listCalls()).isEqualTo(calls);

        makeStale();
        mockMvc.perform(get(PATH))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].rceptNo").value("20261026000001"))
                .andExpect(jsonPath("$.items[0].group").value("GOVERNANCE"));
        assertThat(listCalls()).isEqualTo(calls + 1);
    }

    @Test
    @DisplayName("받아 둔 기간보다 긴 기간을 물으면 다시 받는다")
    void longerPeriodRefetches() throws Exception {
        answer(item("20261020000001", "최대주주변경", daysAgo(3), ""));
        mockMvc.perform(get(PATH).param("days", "30")).andExpect(status().isOk());
        long calls = listCalls();

        answer(item("20261020000001", "최대주주변경", daysAgo(3), ""),
                item("20260101000001", "사업보고서 (2025.12)", daysAgo(200), ""));
        mockMvc.perform(get(PATH).param("days", "365"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.from").value(iso(365)))
                .andExpect(jsonPath("$.items", hasSize(2)));
        assertThat(listCalls()).isEqualTo(calls + 1);
        assertThat(SERVER.requests().get(SERVER.requests().size() - 1)).contains("bgn_de=" + daysAgo(365));
    }

    @Test
    @DisplayName("묶음을 거르면 그 묶음만 돌려주고 건수는 기간 전체로 센다")
    void filtersByGroupKeepingCounts() throws Exception {
        answer(item("20261020000001", "임원ㆍ주요주주특정증권등소유상황보고서", daysAgo(3), ""),
                item("20261020000002", "주식등의대량보유상황보고서(일반)", daysAgo(3), ""),
                item("20261001000001", "주요사항보고서(전환사채권발행결정)", daysAgo(20), ""));

        mockMvc.perform(get(PATH).param("group", "OWNERSHIP"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.items[0].group").value("OWNERSHIP"))
                .andExpect(jsonPath("$.items[1].group").value("OWNERSHIP"))
                .andExpect(jsonPath("$.groups[1].count").value(2))
                .andExpect(jsonPath("$.groups[2].count").value(1));
    }

    @Test
    @DisplayName("기간 밖의 저장된 공시는 넣지 않는다")
    void excludesOlderThanRequestedDays() throws Exception {
        answer(item("20261020000001", "최대주주변경", daysAgo(3), ""),
                item("20260801000001", "최대주주변경", daysAgo(80), ""));
        mockMvc.perform(get(PATH)).andExpect(status().isOk()).andExpect(jsonPath("$.items", hasSize(2)));

        mockMvc.perform(get(PATH).param("days", "30"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.from").value(iso(30)))
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.groups[1].count").value(1));
    }

    @Test
    @DisplayName("자료 없음(013)은 빈 목록이다")
    void noDataIsEmptyList() throws Exception {
        SERVER.on("/api/list.json", Response.json(DisclosureListJson.NO_DATA));

        mockMvc.perform(get(PATH))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fetchedAt").isNotEmpty())
                .andExpect(jsonPath("$.items", hasSize(0)))
                .andExpect(jsonPath("$.groups[5].count").value(0));
    }

    @Test
    @DisplayName("다시 받다 실패하면 저장된 목록과 실패 이유를 돌려준다")
    void servesSavedListWhenRefreshFails() throws Exception {
        answer(item("20261020000001", "최대주주변경", daysAgo(3), ""));
        mockMvc.perform(get(PATH)).andExpect(status().isOk());
        makeStale();
        SERVER.on("/api/list.json", Response.json(DisclosureListJson.RATE_LIMITED));

        mockMvc.perform(get(PATH))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.refreshError").value("DART_RATE_LIMITED"))
                .andExpect(jsonPath("$.items", hasSize(1)));

        SERVER.on("/api/list.json", Response.status(500));
        mockMvc.perform(get(PATH).param("days", "365"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.refreshError").value("DART_REQUEST_FAILED"))
                .andExpect(jsonPath("$.from").value(iso(90)))
                .andExpect(jsonPath("$.items", hasSize(1)));
    }

    @Test
    @DisplayName("저장된 목록이 없는데 받지 못하면 에러다")
    void failsWhenNothingIsSaved() throws Exception {
        SERVER.on("/api/list.json", Response.json(DisclosureListJson.RATE_LIMITED));

        mockMvc.perform(get(PATH))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("DART_RATE_LIMITED"));

        SERVER.on("/api/list.json", Response.status(500));
        mockMvc.perform(get(PATH))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.code").value("DART_REQUEST_FAILED"));
    }

    @Test
    @DisplayName("기간과 묶음 값을 확인한다")
    void validatesDaysAndGroup() throws Exception {
        for (String days : List.of("0", "366", "abc")) {
            mockMvc.perform(get(PATH).param("days", days))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"))
                    .andExpect(jsonPath("$.errors[0].field").value("days"));
        }
        mockMvc.perform(get(PATH).param("group", "SOMETHING"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"))
                .andExpect(jsonPath("$.errors[0].field").value("group"));
    }

    @Test
    @DisplayName("없는 기업은 404다")
    void unknownCompanyIsNotFound() throws Exception {
        mockMvc.perform(get("/api/companies/99999999/disclosures"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COMPANY_NOT_FOUND"));
    }
}
