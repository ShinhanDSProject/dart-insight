package com.dartinsight.financial.controller;

import static com.dartinsight.dart.client.DisclosureListJson.item;
import static com.dartinsight.dart.client.DisclosureListJson.page;
import static com.dartinsight.dart.client.KeyAccountJson.row;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dartinsight.company.service.CompanyImportService;
import com.dartinsight.dart.client.FakeOpenDartServer;
import com.dartinsight.dart.client.FakeOpenDartServer.Response;
import com.dartinsight.dart.client.KeyAccountJson;
import com.dartinsight.dart.domain.CorpCodeEntry;
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
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/** GET /api/companies/{corpCode}/financial-trends (1.2, FS-46). OpenDART는 가짜 서버다(T-2). */
@SpringBootTest
@AutoConfigureMockMvc
class FinancialTrendApiTest {

    private static final FakeOpenDartServer SERVER = startServer();
    private static final String KEY_ACCOUNTS = "/api/fnlttSinglAcnt.json";
    private static final String URL = "/api/companies/00000001/financial-trends";

    private static final String HALF = "20260814000001";
    private static final String Q1 = "20260515000001";
    private static final String ANNUAL = "20260310000001";
    private static final String ANNUAL_CORRECTED = "20260401000009";

    // accounts 배열 순서(docs/api-spec.md): 재무상태표 9개, 손익 5개
    private static final int TOTAL_ASSETS = 2;
    private static final int REVENUE = 9;
    private static final int OPERATING_INCOME = 10;
    private static final int NET_INCOME = 12;

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
                item(Q1, "분기보고서 (2026.03)", "20260515", ""),
                item(HALF, "반기보고서 (2026.06)", "20260814", ""),
                item(ANNUAL, "사업보고서 (2025.12)", "20260310", ""),
                item("20150331000001", "사업보고서 (2014.12)", "20150331", ""))));
    }

    private static String halfAccounts() {
        return KeyAccountJson.ok(
                row(HALF, "CFS", "BS", "자산총계", 5, "759,480", null),
                row(HALF, "CFS", "IS", "매출액", 23, "171", "305"),
                row(HALF, "CFS", "IS", "영업이익(손실)", 25, "0", "-"),
                row(HALF, "CFS", "IS", "당기순이익(손실)", 29, "5", "9"),
                row(HALF, "CFS", "IS", "당기순이익(손실)", 61, "999", "999"),
                row(HALF, "CFS", "IS", "이자수익", 70, "1", "2"),
                row(HALF, "OFS", "BS", "자산총계", 6, "400", null));
    }

    private static String annualAccounts() {
        return KeyAccountJson.ok(row(ANNUAL_CORRECTED, "CFS", "IS", "매출액", 23, "3,336", null));
    }

    private long keyAccountCalls() {
        return SERVER.requests().stream().filter(r -> r.startsWith(KEY_ACCOUNTS)).count();
    }

    @Test
    @DisplayName("최근 보고서들의 주요계정을 기간 순서대로 돌려주고, 없는 값은 0이 아니라 null이다")
    void returnsTrendWithNullForMissingValues() throws Exception {
        SERVER.on(KEY_ACCOUNTS, Response.json(halfAccounts()), Response.json(KeyAccountJson.NO_DATA),
                Response.json(annualAccounts()));
        long before = keyAccountCalls();

        mockMvc.perform(get(URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.corpCode").value("00000001"))
                .andExpect(jsonPath("$.fsDiv").value("CFS"))
                .andExpect(jsonPath("$.refreshError").value(nullValue()))
                .andExpect(jsonPath("$.periods", hasSize(4)))
                .andExpect(jsonPath("$.periods[0].rceptNo").value(HALF))
                .andExpect(jsonPath("$.periods[0].reportType").value("HALF"))
                .andExpect(jsonPath("$.periods[0].reportName").value("반기보고서 (2026.06)"))
                .andExpect(jsonPath("$.periods[0].fiscalYear").value(2026))
                .andExpect(jsonPath("$.periods[0].periodEnd").value("2026-06-30"))
                .andExpect(jsonPath("$.periods[0].dataStatus").value("AVAILABLE"))
                .andExpect(jsonPath("$.periods[0].sourceRceptNo").value(HALF))
                .andExpect(jsonPath("$.periods[0].dartUrl")
                        .value("https://dart.fss.or.kr/dsaf001/main.do?rcpNo=" + HALF))
                .andExpect(jsonPath("$.periods[1].reportType").value("Q1"))
                .andExpect(jsonPath("$.periods[1].dataStatus").value("NOT_AVAILABLE"))
                .andExpect(jsonPath("$.periods[1].sourceRceptNo").value(nullValue()))
                .andExpect(jsonPath("$.periods[2].dataStatus").value("AVAILABLE"))
                .andExpect(jsonPath("$.periods[2].sourceRceptNo").value(ANNUAL_CORRECTED))
                .andExpect(jsonPath("$.periods[3].fiscalYear").value(2014))
                .andExpect(jsonPath("$.periods[3].dataStatus").value("NOT_AVAILABLE"))
                .andExpect(jsonPath("$.accounts", hasSize(14)))
                .andExpect(jsonPath("$.accounts[" + TOTAL_ASSETS + "].key").value("TOTAL_ASSETS"))
                .andExpect(jsonPath("$.accounts[" + TOTAL_ASSETS + "].name").value("자산총계"))
                .andExpect(jsonPath("$.accounts[" + TOTAL_ASSETS + "].sjDiv").value("BS"))
                .andExpect(jsonPath("$.accounts[" + TOTAL_ASSETS + "].amountBasis").value("POINT"))
                .andExpect(jsonPath("$.accounts[" + TOTAL_ASSETS + "].values", hasSize(4)))
                .andExpect(jsonPath("$.accounts[" + TOTAL_ASSETS + "].values[0].amount").value(759480))
                .andExpect(jsonPath("$.accounts[" + TOTAL_ASSETS + "].values[0].currency").value("KRW"))
                .andExpect(jsonPath("$.accounts[" + TOTAL_ASSETS + "].values[2].amount").value(nullValue()))
                .andExpect(jsonPath("$.accounts[" + REVENUE + "].key").value("REVENUE"))
                .andExpect(jsonPath("$.accounts[" + REVENUE + "].amountBasis").value("CUMULATIVE"))
                .andExpect(jsonPath("$.accounts[" + REVENUE + "].values[0].rceptNo").value(HALF))
                .andExpect(jsonPath("$.accounts[" + REVENUE + "].values[0].amount").value(305))
                .andExpect(jsonPath("$.accounts[" + REVENUE + "].values[0].quarterAmount").value(171))
                .andExpect(jsonPath("$.accounts[" + REVENUE + "].values[1].amount").value(nullValue()))
                .andExpect(jsonPath("$.accounts[" + REVENUE + "].values[1].currency").value(nullValue()))
                .andExpect(jsonPath("$.accounts[" + REVENUE + "].values[2].amount").value(3336))
                .andExpect(jsonPath("$.accounts[" + REVENUE + "].values[2].quarterAmount").value(nullValue()))
                .andExpect(jsonPath("$.accounts[" + OPERATING_INCOME + "].key").value("OPERATING_INCOME"))
                .andExpect(jsonPath("$.accounts[" + OPERATING_INCOME + "].values[0].amount").value(nullValue()))
                .andExpect(jsonPath("$.accounts[" + OPERATING_INCOME + "].values[0].quarterAmount").value(0))
                .andExpect(jsonPath("$.accounts[" + NET_INCOME + "].key").value("NET_INCOME"))
                .andExpect(jsonPath("$.accounts[" + NET_INCOME + "].values[0].amount").value(9));

        // 2014 사업연도는 API가 제공하지 않아 부르지 않는다
        assertThat(keyAccountCalls() - before).isEqualTo(3);
        // 보고서의 사업연도·보고서 코드로 부른다(반기 11012, 1분기 11013, 사업 11011)
        List<String> calls = SERVER.requests().stream().filter(r -> r.startsWith(KEY_ACCOUNTS)).toList();
        assertThat(calls.subList(calls.size() - 3, calls.size()))
                .satisfiesExactly(
                        r -> assertThat(r).contains("corp_code=00000001", "bsns_year=2026", "reprt_code=11012"),
                        r -> assertThat(r).contains("bsns_year=2026", "reprt_code=11013"),
                        r -> assertThat(r).contains("bsns_year=2025", "reprt_code=11011"));
    }

    @Test
    @DisplayName("한 번 받은 보고서는 013이었어도 다시 받지 않고, 별도 기준도 저장된 값으로 돌려준다")
    void doesNotFetchSameReportAgain() throws Exception {
        SERVER.on(KEY_ACCOUNTS, Response.json(halfAccounts()), Response.json(KeyAccountJson.NO_DATA),
                Response.json(annualAccounts()));
        mockMvc.perform(get(URL)).andExpect(status().isOk());
        long before = keyAccountCalls();

        mockMvc.perform(get(URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.periods[1].dataStatus").value("NOT_AVAILABLE"))
                .andExpect(jsonPath("$.accounts[" + REVENUE + "].values[0].amount").value(305));
        mockMvc.perform(get(URL).param("fsDiv", "OFS"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fsDiv").value("OFS"))
                .andExpect(jsonPath("$.periods[0].dataStatus").value("AVAILABLE"))
                .andExpect(jsonPath("$.periods[2].dataStatus").value("NOT_AVAILABLE"))
                .andExpect(jsonPath("$.accounts[" + TOTAL_ASSETS + "].values[0].amount").value(400))
                .andExpect(jsonPath("$.accounts[" + REVENUE + "].values[0].amount").value(nullValue()));

        assertThat(keyAccountCalls()).isEqualTo(before);
    }

    @Test
    @DisplayName("일부 보고서를 받지 못해도 200이고 그 기간만 FETCH_FAILED이며, 다음 요청에서 다시 받는다")
    void partialFailureIsRetriedNextTime() throws Exception {
        SERVER.on(KEY_ACCOUNTS, Response.json(halfAccounts()), Response.json(KeyAccountJson.RATE_LIMITED));
        long before = keyAccountCalls();

        mockMvc.perform(get(URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.periods[0].dataStatus").value("AVAILABLE"))
                .andExpect(jsonPath("$.periods[1].dataStatus").value("FETCH_FAILED"))
                .andExpect(jsonPath("$.periods[2].dataStatus").value("FETCH_FAILED"))
                .andExpect(jsonPath("$.accounts[" + REVENUE + "].values[1].amount").value(nullValue()));
        // 한도 초과(020) 뒤에는 남은 보고서를 부르지 않는다
        assertThat(keyAccountCalls() - before).isEqualTo(2);

        SERVER.on(KEY_ACCOUNTS, Response.json(KeyAccountJson.NO_DATA), Response.json(annualAccounts()));
        mockMvc.perform(get(URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.periods[0].dataStatus").value("AVAILABLE"))
                .andExpect(jsonPath("$.periods[1].dataStatus").value("NOT_AVAILABLE"))
                .andExpect(jsonPath("$.periods[2].dataStatus").value("AVAILABLE"))
                .andExpect(jsonPath("$.accounts[" + REVENUE + "].values[2].amount").value(3336));
        assertThat(keyAccountCalls() - before).isEqualTo(4);
    }

    @Test
    @DisplayName("limit만큼 최근 보고서만 고른다")
    void limitsReports() throws Exception {
        SERVER.on(KEY_ACCOUNTS, Response.json(halfAccounts()));
        long before = keyAccountCalls();

        mockMvc.perform(get(URL).param("limit", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.periods", hasSize(1)))
                .andExpect(jsonPath("$.accounts[0].values", hasSize(1)));
        assertThat(keyAccountCalls() - before).isEqualTo(1);
    }

    @Test
    @DisplayName("fsDiv·limit이 맞지 않으면 400 COMMON_INVALID_INPUT")
    void rejectsInvalidInput() throws Exception {
        mockMvc.perform(get(URL).param("fsDiv", "XYZ"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"))
                .andExpect(jsonPath("$.errors[0].field").value("fsDiv"));
        mockMvc.perform(get(URL).param("limit", "0"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("limit"));
        mockMvc.perform(get(URL).param("limit", "21"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("limit"));
    }

    @Test
    @DisplayName("없는 기업은 404 COMPANY_NOT_FOUND")
    void unknownCompanyIsNotFound() throws Exception {
        mockMvc.perform(get("/api/companies/99999999/financial-trends"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COMPANY_NOT_FOUND"));
    }
}
