package com.dartinsight.keyfact.controller;

import static com.dartinsight.dart.client.DisclosureListJson.item;
import static com.dartinsight.dart.client.DisclosureListJson.page;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
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
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
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

/**
 * 최대주주·임원·배당 변화 API(#331). 테스트 자료는 삼성전자 실제 응답에서 일부 행만 남긴 것이다
 * (src/test/resources/opendart/key-facts, 2026-10-26에 받음).
 * <ul>
 *   <li>현재: 반기보고서 (2026.06) 접수번호 20260814003699. 최대주주 6행, 임원 3행, 배당 4행</li>
 *   <li>이전: 반기보고서 (2025.06) 접수번호 20250814003156. 최대주주 5행, 임원 3행, 배당 4행</li>
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
class KeyFactApiTest {

    private static final FakeOpenDartServer SERVER = startServer();
    private static final String CURRENT = "20260814003699";
    private static final String PREVIOUS = "20250814003156";
    private static final String SHAREHOLDERS = "/api/hyslrSttus.json";
    private static final String EXECUTIVES = "/api/exctvSttus.json";
    private static final String DIVIDENDS = "/api/alotMatter.json";

    @DynamicPropertySource
    static void openDart(DynamicPropertyRegistry registry) {
        registry.add("app.opendart.base-url", SERVER::baseUrl);
        registry.add("app.opendart.read-timeout", () -> "2s");
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

    @BeforeEach
    void setUp() {
        TestData.clearAll(jdbcTemplate);
        companyImportService.save(List.of(
                new CorpCodeEntry("00000001", "예시전자", null, "900001", LocalDate.of(2026, 1, 1))));
        SERVER.on("/api/list.json", Response.json(page(1, 1,
                item(CURRENT, "반기보고서 (2026.06)", "20260814", ""),
                item("20260515000001", "분기보고서 (2026.03)", "20260515", ""),
                item(PREVIOUS, "반기보고서 (2025.06)", "20250814", ""))));
        SERVER.on(SHAREHOLDERS, json("major-shareholders-2026-half"), json("major-shareholders-2025-half"));
        SERVER.on(EXECUTIVES, json("executives-2026-half"), json("executives-2025-half"));
        SERVER.on(DIVIDENDS, json("dividends-2026-half"), json("dividends-2025-half"));
    }

    @Test
    @DisplayName("최신 반기보고서와 1년 전 반기보고서의 최대주주·임원·배당을 원문 그대로 나란히 주고 바뀐 항목을 만든다")
    void comparesLatestReportWithSameReportLastYear() throws Exception {
        int before = SERVER.requests().size();
        mockMvc.perform(get("/api/companies/00000001/key-facts"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.corpCode").value("00000001"))
                .andExpect(jsonPath("$.current.rceptNo").value(CURRENT))
                .andExpect(jsonPath("$.current.reportType").value("HALF"))
                .andExpect(jsonPath("$.current.fiscalYear").value(2026))
                .andExpect(jsonPath("$.current.periodEnd").value("2026-06-30"))
                .andExpect(jsonPath("$.current.dartUrl").value(
                        "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=" + CURRENT))
                .andExpect(jsonPath("$.previous.rceptNo").value(PREVIOUS))
                .andExpect(jsonPath("$.previousReason").value(nullValue()))
                // 최대주주: 원문 값 그대로, 이름의 줄바꿈은 공백 하나
                .andExpect(jsonPath("$.majorShareholders.current.status").value("AVAILABLE"))
                .andExpect(jsonPath("$.majorShareholders.current.rceptNo").value(CURRENT))
                .andExpect(jsonPath("$.majorShareholders.current.settlementDate").value("2026-06-30"))
                .andExpect(jsonPath("$.majorShareholders.current.rows", hasSize(6)))
                .andExpect(jsonPath("$.majorShareholders.current.rows[1].name").value("이재용"))
                .andExpect(jsonPath("$.majorShareholders.current.rows[1].relation").value("최대주주의 특수관계인"))
                .andExpect(jsonPath("$.majorShareholders.current.rows[1].endShares").value("97,414,196"))
                .andExpect(jsonPath("$.majorShareholders.current.rows[1].beginRatio").value("1.65"))
                .andExpect(jsonPath("$.majorShareholders.current.rows[1].endRatio").value("1.67"))
                .andExpect(jsonPath("$.majorShareholders.current.rows[1].remark").value(nullValue()))
                .andExpect(jsonPath("$.majorShareholders.current.rows[4].name").value("삼성생명보험㈜ (특별계정)"))
                .andExpect(jsonPath("$.majorShareholders.previous.rows", hasSize(5)))
                .andExpect(jsonPath("$.majorShareholders.changes", hasSize(6)))
                .andExpect(jsonPath("$.majorShareholders.changes[0].type").value("CHANGED"))
                .andExpect(jsonPath("$.majorShareholders.changes[0].name").value("홍라희"))
                .andExpect(jsonPath("$.majorShareholders.changes[0].before").value("1.66"))
                .andExpect(jsonPath("$.majorShareholders.changes[0].after").value("1.25"))
                .andExpect(jsonPath("$.majorShareholders.changes[1].name").value("이재용"))
                .andExpect(jsonPath("$.majorShareholders.changes[1].stockKind").value("보통주"))
                .andExpect(jsonPath("$.majorShareholders.changes[1].field").value("endRatio"))
                .andExpect(jsonPath("$.majorShareholders.changes[1].before").value("1.65"))
                .andExpect(jsonPath("$.majorShareholders.changes[1].after").value("1.67"))
                .andExpect(jsonPath("$.majorShareholders.changes[2].type").value("ADDED"))
                .andExpect(jsonPath("$.majorShareholders.changes[2].name").value("김용관"))
                .andExpect(jsonPath("$.majorShareholders.changes[2].before").value(nullValue()))
                .andExpect(jsonPath("$.majorShareholders.changes[2].after").value("0.00"))
                // 지분율이 같고 주식 수만 다르면 주식 수
                .andExpect(jsonPath("$.majorShareholders.changes[3].name").value("송재혁"))
                .andExpect(jsonPath("$.majorShareholders.changes[3].field").value("endShares"))
                .andExpect(jsonPath("$.majorShareholders.changes[3].before").value("9,300"))
                .andExpect(jsonPath("$.majorShareholders.changes[3].after").value("0"))
                .andExpect(jsonPath("$.majorShareholders.changes[5].name").value("계"))
                .andExpect(jsonPath("$.majorShareholders.changes[5].before").value("20.15"))
                .andExpect(jsonPath("$.majorShareholders.changes[5].after").value("19.69"))
                // 임원: 새 임원, 등기 구분 변경, 빠진 임원
                .andExpect(jsonPath("$.executives.current.rows", hasSize(3)))
                .andExpect(jsonPath("$.executives.current.rows[1].name").value("김용관"))
                .andExpect(jsonPath("$.executives.current.rows[1].position").value("사장"))
                .andExpect(jsonPath("$.executives.current.rows[1].registeredType").value("사내이사"))
                .andExpect(jsonPath("$.executives.current.rows[1].termEnd").value("2029년 03월 17일"))
                .andExpect(jsonPath("$.executives.current.rows[1].birthYm").doesNotExist())
                .andExpect(jsonPath("$.executives.changes", hasSize(3)))
                .andExpect(jsonPath("$.executives.changes[0].type").value("ADDED"))
                .andExpect(jsonPath("$.executives.changes[0].name").value("김용관"))
                .andExpect(jsonPath("$.executives.changes[0].stockKind").value(nullValue()))
                .andExpect(jsonPath("$.executives.changes[0].after").value("사장"))
                .andExpect(jsonPath("$.executives.changes[1].type").value("CHANGED"))
                .andExpect(jsonPath("$.executives.changes[1].name").value("신제윤"))
                .andExpect(jsonPath("$.executives.changes[1].field").value("registeredType"))
                .andExpect(jsonPath("$.executives.changes[1].before").value("사외이사"))
                .andExpect(jsonPath("$.executives.changes[1].after").value("독립이사"))
                .andExpect(jsonPath("$.executives.changes[2].type").value("REMOVED"))
                .andExpect(jsonPath("$.executives.changes[2].name").value("송재혁"))
                .andExpect(jsonPath("$.executives.changes[2].before").value("사장"))
                // 배당: 원문 '-'는 null, 바뀐 항목은 주당 현금배당금만
                .andExpect(jsonPath("$.dividends.current.rows", hasSize(4)))
                .andExpect(jsonPath("$.dividends.current.rows[0].category").value("현금배당금총액(백만원)"))
                .andExpect(jsonPath("$.dividends.current.rows[0].stockKind").value(nullValue()))
                .andExpect(jsonPath("$.dividends.current.rows[0].currentTerm").value("4,909,211"))
                .andExpect(jsonPath("$.dividends.current.rows[1].currentTerm").value(nullValue()))
                .andExpect(jsonPath("$.dividends.changes", hasSize(2)))
                .andExpect(jsonPath("$.dividends.changes[0].name").value("주당 현금배당금(원)"))
                .andExpect(jsonPath("$.dividends.changes[0].stockKind").value("보통주"))
                .andExpect(jsonPath("$.dividends.changes[0].field").value("currentTerm"))
                .andExpect(jsonPath("$.dividends.changes[0].before").value("732"))
                .andExpect(jsonPath("$.dividends.changes[0].after").value("746"));

        List<String> requests = SERVER.requests();
        assertThat(requests.subList(before, requests.size())).filteredOn(r -> r.startsWith(SHAREHOLDERS)).hasSize(2)
                .anySatisfy(r -> assertThat(r).contains("bsns_year=2026", "reprt_code=11012"))
                .anySatisfy(r -> assertThat(r).contains("bsns_year=2025", "reprt_code=11012"));
    }

    @Test
    @DisplayName("한 번 받은 보고서의 자료는 다시 받지 않는다")
    void savedResultsAreNotFetchedAgain() throws Exception {
        int before = keyFactRequests();
        mockMvc.perform(get("/api/companies/00000001/key-facts")).andExpect(status().isOk());
        assertThat(keyFactRequests() - before).isEqualTo(6);

        mockMvc.perform(get("/api/companies/00000001/key-facts"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.majorShareholders.current.rows", hasSize(6)))
                .andExpect(jsonPath("$.majorShareholders.current.settlementDate").value("2026-06-30"))
                .andExpect(jsonPath("$.majorShareholders.changes", hasSize(6)))
                .andExpect(jsonPath("$.executives.previous.rows[1].name").value("송재혁"));
        assertThat(keyFactRequests() - before).isEqualTo(6);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM report_key_fact", Integer.class)).isEqualTo(6);
    }

    @Test
    @DisplayName("자료 없음(013)은 실패가 아니라 빈 묶음이고, 바뀐 항목을 만들지 않는다")
    void noDataIsAnEmptySection() throws Exception {
        SERVER.on(EXECUTIVES, Response.json(DisclosureListJson.NO_DATA));

        mockMvc.perform(get("/api/companies/00000001/key-facts"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.executives.current.status").value("NO_DATA"))
                .andExpect(jsonPath("$.executives.current.settlementDate").value(nullValue()))
                .andExpect(jsonPath("$.executives.current.rows", hasSize(0)))
                .andExpect(jsonPath("$.executives.previous.status").value("NO_DATA"))
                .andExpect(jsonPath("$.executives.changes", hasSize(0)))
                .andExpect(jsonPath("$.majorShareholders.current.status").value("AVAILABLE"));
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM report_key_fact WHERE kind = 'EXECUTIVES' AND status = 'NO_DATA'",
                Integer.class)).isEqualTo(2);
    }

    @Test
    @DisplayName("같은 종류의 1년 전 보고서가 없으면 이전 묶음은 null이고 이유를 준다")
    void missingPreviousReportGivesReason() throws Exception {
        SERVER.on("/api/list.json", Response.json(page(1, 1,
                item(CURRENT, "반기보고서 (2026.06)", "20260814", ""))));

        mockMvc.perform(get("/api/companies/00000001/key-facts"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.current.rceptNo").value(CURRENT))
                .andExpect(jsonPath("$.previous").value(nullValue()))
                .andExpect(jsonPath("$.previousReason.code").value("NO_BASE_REPORT"))
                .andExpect(jsonPath("$.majorShareholders.current.status").value("AVAILABLE"))
                .andExpect(jsonPath("$.majorShareholders.previous").value(nullValue()))
                .andExpect(jsonPath("$.majorShareholders.changes", hasSize(0)))
                .andExpect(jsonPath("$.dividends.previous").value(nullValue()));
    }

    @Test
    @DisplayName("한 묶음을 받지 못하면 그 묶음만 UNAVAILABLE이고 저장하지 않아 다음 조회 때 다시 받는다")
    void failedSectionIsUnavailableAndRetriedLater() throws Exception {
        SERVER.on(DIVIDENDS, Response.json(DisclosureListJson.RATE_LIMITED),
                Response.json(DisclosureListJson.RATE_LIMITED),
                json("dividends-2026-half"), json("dividends-2025-half"));

        mockMvc.perform(get("/api/companies/00000001/key-facts"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dividends.current.status").value("UNAVAILABLE"))
                .andExpect(jsonPath("$.dividends.previous.status").value("UNAVAILABLE"))
                .andExpect(jsonPath("$.dividends.changes", hasSize(0)))
                .andExpect(jsonPath("$.majorShareholders.current.status").value("AVAILABLE"));
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM report_key_fact WHERE kind = 'DIVIDENDS'", Integer.class)).isZero();

        mockMvc.perform(get("/api/companies/00000001/key-facts"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dividends.current.status").value("AVAILABLE"))
                .andExpect(jsonPath("$.dividends.changes", hasSize(2)));
    }

    @Test
    @DisplayName("없는 기업은 404 COMPANY_NOT_FOUND")
    void unknownCompanyIsNotFound() throws Exception {
        mockMvc.perform(get("/api/companies/99999999/key-facts"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COMPANY_NOT_FOUND"));
    }

    private static int keyFactRequests() {
        return (int) SERVER.requests().stream()
                .filter(r -> r.startsWith(SHAREHOLDERS) || r.startsWith(EXECUTIVES) || r.startsWith(DIVIDENDS))
                .count();
    }

    private static Response json(String name) {
        try (InputStream in = KeyFactApiTest.class.getResourceAsStream("/opendart/key-facts/" + name + ".json")) {
            if (in == null) {
                throw new IllegalStateException("테스트 자료가 없습니다: " + name);
            }
            return Response.json(new String(in.readAllBytes(), StandardCharsets.UTF_8));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
