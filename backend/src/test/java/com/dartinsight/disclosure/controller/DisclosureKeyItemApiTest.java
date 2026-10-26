package com.dartinsight.disclosure.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.matchesPattern;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dartinsight.company.service.CompanyImportService;
import com.dartinsight.dart.client.FakeOpenDartServer;
import com.dartinsight.dart.client.FakeOpenDartServer.Response;
import com.dartinsight.dart.domain.CorpCodeEntry;
import com.dartinsight.support.TestData;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
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
 * 주요사항보고서 핵심 수치 API(#363, FS-51). 테스트 자료는 OpenDART 주요사항보고서 주요정보(DS005) 실제 응답이다
 * (src/test/resources/opendart/key-items, 2026-10-26에 받음). 공시 목록 행은 같은 공시의 실제 공시검색 값(제목·접수일)을
 * 가짜 기업(00000001)에 넣었다.
 * <ul>
 *   <li>유상증자: 에코프로비엠 [기재정정]주요사항보고서(유상증자결정) 20261013000198(최초 접수 20260630). 1행</li>
 *   <li>전환사채: 국전 주요사항보고서(전환사채권발행결정) 20261023000414. 1행</li>
 *   <li>신주인수권부사채: 두산퓨얼셀 주요사항보고서(신주인수권부사채권발행결정) 20261013000372. 1행</li>
 *   <li>교환사채: LS전선 주요사항보고서(교환사채권발행결정) 20260911000411. 1행</li>
 *   <li>자기주식 취득: 피씨디렉트 주요사항보고서(자기주식취득결정) 20261026000139. 1행</li>
 *   <li>자기주식 처분: 에코프로비엠 2025-10-01~11-30로 부른 응답 2행(20251020000144, 20251118000105)</li>
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
class DisclosureKeyItemApiTest {

    private static final FakeOpenDartServer SERVER = startServer();
    private static final String CORP = "00000001";

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

    @BeforeEach
    void setUp() {
        TestData.clearAll(jdbcTemplate);
        companyImportService.save(List.of(
                new CorpCodeEntry(CORP, "예시전자", null, "900001", LocalDate.of(2026, 1, 1))));
        disclosure("20261013000198", "[기재정정]주요사항보고서(유상증자결정)", "2026-10-13");
        disclosure("20261023000414", "주요사항보고서(전환사채권발행결정)", "2026-10-23");
        disclosure("20261013000372", "주요사항보고서(신주인수권부사채권발행결정)", "2026-10-13");
        disclosure("20260911000411", "주요사항보고서(교환사채권발행결정)", "2026-09-11");
        disclosure("20261026000139", "주요사항보고서(자기주식취득결정)", "2026-10-26");
        disclosure("20251020000144", "주요사항보고서(자기주식처분결정)", "2025-10-20");
        disclosure("20261026000100", "[첨부정정]주요사항보고서(전환사채권발행결정)", "2026-10-26");
        disclosure("20261026000017", "임원ㆍ주요주주특정증권등소유상황보고서", "2026-10-26");
        SERVER.on("/api/piicDecsn.json", json("capital-increase-ecoprobm-20261013000198"));
        SERVER.on("/api/cvbdIsDecsn.json", json("convertible-bond-kukjeon-20261023000414"));
        SERVER.on("/api/bdwtIsDecsn.json", json("bond-with-warrant-doosanfuelcell-20261013000372"));
        SERVER.on("/api/exbdIsDecsn.json", json("exchangeable-bond-lscable-20260911000411"));
        SERVER.on("/api/tsstkAqDecsn.json", json("treasury-acquisition-pcdirect-20261026000139"));
        SERVER.on("/api/tsstkDpDecsn.json", json("treasury-disposal-ecoprobm-20251020000144"));
    }

    @Test
    @DisplayName("유상증자 [기재정정]은 2015-01-01부터 접수일까지 불러 같은 접수번호 행의 값을 원문 그대로 준다")
    void capitalIncreaseCorrectionUsesWholeHistoryWindow() throws Exception {
        mockMvc.perform(get(path("20261013000198")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rceptNo").value("20261013000198"))
                .andExpect(jsonPath("$.kind").value("CAPITAL_INCREASE"))
                .andExpect(jsonPath("$.kindLabel").value("유상증자 결정"))
                .andExpect(jsonPath("$.status").value("AVAILABLE"))
                .andExpect(jsonPath("$.sourceUrl").value(
                        "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20261013000198"))
                .andExpect(jsonPath("$.fetchedAt", matchesPattern("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}")))
                // '-'인 항목(기타주식·시설자금 등)은 빼고 정한 순서대로
                .andExpect(jsonPath("$.items", hasSize(5)))
                .andExpect(jsonPath("$.items[0].field").value("nstk_ostk_cnt"))
                .andExpect(jsonPath("$.items[0].label").value("신주의 종류와 수(보통주식)"))
                .andExpect(jsonPath("$.items[0].value").value("9,900,990"))
                .andExpect(jsonPath("$.items[0].unit").value("주"))
                .andExpect(jsonPath("$.items[1].value").value("500"))
                .andExpect(jsonPath("$.items[1].unit").value("원"))
                .andExpect(jsonPath("$.items[2].value").value("97,830,434"))
                .andExpect(jsonPath("$.items[3].field").value("ic_mthn"))
                .andExpect(jsonPath("$.items[3].value").value("주주배정후 실권주 일반공모"))
                .andExpect(jsonPath("$.items[3].unit").value(nullValue()))
                .andExpect(jsonPath("$.items[4].label").value("자금조달의 목적(타법인 증권 취득자금)"))
                .andExpect(jsonPath("$.items[4].value").value("886,138,605,000"));

        String request = last("/api/piicDecsn.json");
        assertThat(request).contains("corp_code=00000001").contains("bgn_de=20150101").contains("end_de=20261013");
    }

    @Test
    @DisplayName("전환사채 원본은 접수일 하루만 불러 사채·전환 항목을 단위와 함께 준다")
    void convertibleBondUsesReceiptDay() throws Exception {
        mockMvc.perform(get(path("20261023000414")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kind").value("CONVERTIBLE_BOND"))
                .andExpect(jsonPath("$.items[0].field").value("bd_tm"))
                .andExpect(jsonPath("$.items[0].value").value("4"))
                .andExpect(jsonPath("$.items[2].field").value("bd_fta"))
                .andExpect(jsonPath("$.items[2].value").value("17,000,000,000"))
                .andExpect(jsonPath("$.items[2].unit").value("원"))
                .andExpect(jsonPath("$.items[3].value").value("0.0"))
                .andExpect(jsonPath("$.items[3].unit").value("%"))
                .andExpect(jsonPath("$.items[5].value").value("2031년 11월 02일"))
                .andExpect(jsonPath("$.items[7].field").value("cv_prc"))
                .andExpect(jsonPath("$.items[7].value").value("2,696"))
                .andExpect(jsonPath("$.items[7].unit").value("원/주"))
                .andExpect(jsonPath("$.items[9].value").value("6,305,637"))
                .andExpect(jsonPath("$.items[10].value").value("10.46"))
                .andExpect(jsonPath("$.items[13].label").value("자금조달의 목적(채무상환자금)"))
                .andExpect(jsonPath("$.items[13].value").value("17,000,000,000"))
                .andExpect(jsonPath("$.items[16].field").value("bddd"))
                .andExpect(jsonPath("$.items", hasSize(17)));

        assertThat(last("/api/cvbdIsDecsn.json")).contains("bgn_de=20261023").contains("end_de=20261023");
    }

    @Test
    @DisplayName("신주인수권부사채·교환사채는 행사가액·교환가액과 대상 주식을 준다")
    void bondWithWarrantAndExchangeableBond() throws Exception {
        mockMvc.perform(get(path("20261013000372")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kind").value("BOND_WITH_WARRANT"))
                .andExpect(jsonPath("$.items[?(@.field == 'ex_prc')].value").value("43,704"))
                .andExpect(jsonPath("$.items[?(@.field == 'ex_prc')].unit").value("원/주"))
                .andExpect(jsonPath("$.items[?(@.field == 'bdwt_div_atn')].value").value("비분리"))
                .andExpect(jsonPath("$.items[?(@.field == 'nstk_isstk_cnt')].value").value("2,288,120"));

        mockMvc.perform(get(path("20260911000411")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kind").value("EXCHANGEABLE_BOND"))
                .andExpect(jsonPath("$.kindLabel").value("교환사채권 발행결정"))
                .andExpect(jsonPath("$.items[?(@.field == 'bd_fta')].value").value("500,000,000,000"))
                .andExpect(jsonPath("$.items[?(@.field == 'ex_prc')].value").value("270,000"))
                .andExpect(jsonPath("$.items[?(@.field == 'extg')].value").value("가온전선(주) 기명식 보통주"))
                .andExpect(jsonPath("$.items[?(@.field == 'extg_stkcnt')].value").value("1,851,851"))
                // '-'인 교환대상 주식총수 대비 비율은 뺀다
                .andExpect(jsonPath("$.items[?(@.field == 'extg_tisstk_vs')]", hasSize(0)));
    }

    @Test
    @DisplayName("자기주식 취득·처분은 예정 주식·금액·기간을 주고, 처분은 여러 행 중 같은 접수번호 행을 쓴다")
    void treasuryStockAcquisitionAndDisposal() throws Exception {
        mockMvc.perform(get(path("20261026000139")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kind").value("TREASURY_STOCK_ACQUISITION"))
                .andExpect(jsonPath("$.items[0].label").value("취득예정주식(보통주식)"))
                .andExpect(jsonPath("$.items[0].value").value("364,698"))
                .andExpect(jsonPath("$.items[1].label").value("취득예정금액(보통주식)"))
                .andExpect(jsonPath("$.items[1].value").value("500,000,958"))
                .andExpect(jsonPath("$.items[?(@.field == 'aq_mth')].value").value("코스닥시장을 통한 장내 직접 취득"));

        mockMvc.perform(get(path("20251020000144")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kind").value("TREASURY_STOCK_DISPOSAL"))
                .andExpect(jsonPath("$.items[0].value").value("65,168"))
                .andExpect(jsonPath("$.items[1].value").value("161,000"))
                .andExpect(jsonPath("$.items[2].value").value("10,492,048,000"))
                .andExpect(jsonPath("$.items[?(@.field == 'dp_pp')].value").value("종업원에 대한 상여금 지급 (RSU)"))
                .andExpect(jsonPath("$.items[?(@.field == 'dp_m_etc')].unit").value("주"));
        assertThat(last("/api/tsstkDpDecsn.json")).contains("bgn_de=20251020").contains("end_de=20251020");
    }

    @Test
    @DisplayName("한 번 받은 공시는 다시 부르지 않는다")
    void doesNotRefetchSameDisclosure() throws Exception {
        mockMvc.perform(get(path("20261023000414"))).andExpect(status().isOk());
        int calls = count("/api/cvbdIsDecsn.json");
        mockMvc.perform(get(path("20261023000414")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[7].value").value("2,696"));
        assertThat(count("/api/cvbdIsDecsn.json")).isEqualTo(calls);
    }

    @Test
    @DisplayName("013이면 자료 없음으로 저장하고 다시 부르지 않는다")
    void noDataIsSavedAndNotRefetched() throws Exception {
        SERVER.on("/api/cvbdIsDecsn.json",
                Response.json("{\"status\":\"013\",\"message\":\"조회된 데이타가 없습니다.\"}"));
        mockMvc.perform(get(path("20261023000414")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NO_DATA"))
                .andExpect(jsonPath("$.items", hasSize(0)))
                .andExpect(jsonPath("$.sourceUrl").value(
                        "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20261023000414"));
        int calls = count("/api/cvbdIsDecsn.json");
        mockMvc.perform(get(path("20261023000414")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NO_DATA"));
        assertThat(count("/api/cvbdIsDecsn.json")).isEqualTo(calls);
    }

    @Test
    @DisplayName("응답에 같은 접수번호의 행이 없으면 자료 없음이다")
    void missingRowIsNoData() throws Exception {
        SERVER.on("/api/tsstkDpDecsn.json", json("treasury-disposal-ecoprobm-20251020000144"));
        disclosure("20251118000999", "주요사항보고서(자기주식처분결정)", "2025-11-18");
        mockMvc.perform(get(path("20251118000999")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NO_DATA"))
                .andExpect(jsonPath("$.items", hasSize(0)));
    }

    @Test
    @DisplayName("지원하지 않는 종류·첨부정정·목록에 없는 공시는 404이고 OpenDART를 부르지 않는다")
    void unsupportedOrUnknownIsNotFound() throws Exception {
        int before = SERVER.requests().size();
        mockMvc.perform(get(path("20261026000017")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COMPANY_DISCLOSURE_NOT_FOUND"));
        mockMvc.perform(get(path("20261026000100")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COMPANY_DISCLOSURE_NOT_FOUND"));
        mockMvc.perform(get(path("20990101000001")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COMPANY_DISCLOSURE_NOT_FOUND"));
        mockMvc.perform(get("/api/companies/99999999/disclosures/20261023000414/key-items"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COMPANY_NOT_FOUND"));
        assertThat(SERVER.requests()).hasSize(before);
    }

    @Test
    @DisplayName("OpenDART 호출이 실패하면 저장하지 않고 에러를 준다")
    void requestFailureIsNotSaved() throws Exception {
        SERVER.on("/api/cvbdIsDecsn.json",
                Response.json("{\"status\":\"020\",\"message\":\"요청 제한을 초과하였습니다.\"}"));
        mockMvc.perform(get(path("20261023000414")))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("DART_RATE_LIMITED"));
        Integer saved = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM disclosure_key_item", Integer.class);
        assertThat(saved).isZero();
    }

    private static String path(String rceptNo) {
        return "/api/companies/" + CORP + "/disclosures/" + rceptNo + "/key-items";
    }

    private void disclosure(String rceptNo, String reportName, String rceptDt) {
        jdbcTemplate.update("INSERT INTO company_disclosure (corp_code, rcept_no, report_name, filer_name, rcept_dt,"
                + " remark, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", CORP, rceptNo, reportName, "예시전자",
                Date.valueOf(rceptDt), null, Timestamp.valueOf(LocalDateTime.of(2026, 10, 26, 9, 0)));
    }

    private static String last(String apiPath) {
        List<String> requests = SERVER.requests().stream().filter(r -> r.startsWith(apiPath)).toList();
        assertThat(requests).isNotEmpty();
        return requests.get(requests.size() - 1);
    }

    private static int count(String apiPath) {
        return (int) SERVER.requests().stream().filter(r -> r.startsWith(apiPath)).count();
    }

    private static Response json(String name) {
        String file = "/opendart/key-items/" + name + ".json";
        try (InputStream in = DisclosureKeyItemApiTest.class.getResourceAsStream(file)) {
            if (in == null) {
                throw new IllegalStateException("테스트 자료가 없습니다: " + file);
            }
            return Response.json(new String(in.readAllBytes(), StandardCharsets.UTF_8));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
