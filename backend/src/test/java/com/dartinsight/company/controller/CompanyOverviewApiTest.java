package com.dartinsight.company.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dartinsight.company.service.CompanyImportService;
import com.dartinsight.dart.client.CompanyJson;
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
class CompanyOverviewApiTest {

    private static final String SAMSUNG = "00126380";
    private static final String OVERVIEW = "/api/companies/{corpCode}/overview";
    private static final FakeOpenDartServer SERVER = startServer();

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
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private CompanyImportService importService;

    @Autowired
    private Clock clock;

    @BeforeEach
    void setUp() {
        TestData.clearAll(jdbcTemplate);
        importService.save(List.of(new CorpCodeEntry(SAMSUNG, "삼성전자", null, "005930", LocalDate.of(2026, 1, 1))));
    }

    private long companyCalls() {
        return SERVER.requests().stream().filter(r -> r.startsWith("/api/company.json")).count();
    }

    /** 저장된 개황의 받은 시각을 days일 전으로 옮긴다. */
    private void ageOverview(int days) {
        jdbcTemplate.update("UPDATE company_overview SET fetched_at = ? WHERE corp_code = ?",
                Timestamp.valueOf(LocalDateTime.now(clock).minusDays(days)), SAMSUNG);
    }

    @Test
    @DisplayName("기업개황을 OpenDART 값 그대로 돌려주고, 두 번째 조회는 OpenDART를 다시 부르지 않는다")
    void returnsOverviewAndCachesIt() throws Exception {
        SERVER.on("/api/company.json", Response.json(CompanyJson.SAMSUNG));
        long before = companyCalls();

        mockMvc.perform(get(OVERVIEW, SAMSUNG))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.corpCode").value(SAMSUNG))
                .andExpect(jsonPath("$.available").value(true))
                .andExpect(jsonPath("$.corpName").value("삼성전자(주)"))
                .andExpect(jsonPath("$.corpNameEng").value("SAMSUNG ELECTRONICS CO,.LTD"))
                .andExpect(jsonPath("$.stockName").value("삼성전자"))
                .andExpect(jsonPath("$.stockCode").value("005930"))
                .andExpect(jsonPath("$.ceoName").value("전영현, 노태문"))
                .andExpect(jsonPath("$.corpClass").value("Y"))
                .andExpect(jsonPath("$.indutyCode").value("264"))
                .andExpect(jsonPath("$.establishedDate").value("1969-01-13"))
                .andExpect(jsonPath("$.accountingMonth").value(12))
                .andExpect(jsonPath("$.homepageUrl").value("www.samsung.com/sec"))
                .andExpect(jsonPath("$.irUrl").value(nullValue()))
                .andExpect(jsonPath("$.address").value("경기도 수원시 영통구  삼성로 129 (매탄동)"))
                .andExpect(jsonPath("$.phoneNumber").value("02-2255-0114"))
                .andExpect(jsonPath("$.fetchedAt").isString())
                .andExpect(jsonPath("$.refreshError").value(nullValue()));
        mockMvc.perform(get(OVERVIEW, SAMSUNG))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ceoName").value("전영현, 노태문"));

        assertThat(companyCalls() - before).isEqualTo(1);
        assertThat(SERVER.requests().getLast()).contains("corp_code=" + SAMSUNG);
    }

    @Test
    @DisplayName("받은 지 7일이 지나면 다시 받아 저장한 값을 바꾼다")
    void refetchesAfterRefreshPeriod() throws Exception {
        SERVER.on("/api/company.json", Response.json(CompanyJson.SAMSUNG));
        mockMvc.perform(get(OVERVIEW, SAMSUNG)).andExpect(status().isOk());
        ageOverview(6);
        SERVER.on("/api/company.json", Response.json(CompanyJson.withCeo("새대표")));
        long before = companyCalls();

        mockMvc.perform(get(OVERVIEW, SAMSUNG))
                .andExpect(jsonPath("$.ceoName").value("전영현, 노태문"));
        assertThat(companyCalls()).isEqualTo(before);

        ageOverview(8);
        mockMvc.perform(get(OVERVIEW, SAMSUNG))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ceoName").value("새대표"))
                .andExpect(jsonPath("$.refreshError").value(nullValue()));
        assertThat(companyCalls()).isEqualTo(before + 1);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM company_overview", Integer.class)).isEqualTo(1);
    }

    @Test
    @DisplayName("013(자료 없음)은 200 available=false이고, 자료 없음도 저장해 다시 묻지 않는다")
    void noDataIsEmptyResultAndCached() throws Exception {
        SERVER.on("/api/company.json", Response.json(CompanyJson.NO_DATA));
        long before = companyCalls();

        mockMvc.perform(get(OVERVIEW, SAMSUNG))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.corpCode").value(SAMSUNG))
                .andExpect(jsonPath("$.available").value(false))
                .andExpect(jsonPath("$.corpName").value(nullValue()))
                .andExpect(jsonPath("$.ceoName").value(nullValue()))
                .andExpect(jsonPath("$.establishedDate").value(nullValue()))
                .andExpect(jsonPath("$.fetchedAt").isString());
        mockMvc.perform(get(OVERVIEW, SAMSUNG)).andExpect(jsonPath("$.available").value(false));

        assertThat(companyCalls() - before).isEqualTo(1);
    }

    @Test
    @DisplayName("기업 목록에 없는 고유번호는 OpenDART를 부르지 않고 404 COMPANY_NOT_FOUND")
    void unknownCompanyIsNotFound() throws Exception {
        long before = companyCalls();

        mockMvc.perform(get(OVERVIEW, "99999999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COMPANY_NOT_FOUND"))
                .andExpect(jsonPath("$.traceId").isString());

        assertThat(companyCalls()).isEqualTo(before);
    }

    @Test
    @DisplayName("저장된 개황이 없는데 OpenDART가 실패하면 정해진 에러 코드로 답한다")
    void openDartErrorWithoutCacheIsError() throws Exception {
        SERVER.on("/api/company.json", Response.json(CompanyJson.status("020", "요청 제한을 초과하였습니다.")));

        mockMvc.perform(get(OVERVIEW, SAMSUNG))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("DART_RATE_LIMITED"));

        SERVER.on("/api/company.json", Response.json(CompanyJson.status("900", "정의되지 않은 오류가 발생하였습니다.")));
        mockMvc.perform(get(OVERVIEW, SAMSUNG))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.code").value("DART_REQUEST_FAILED"));
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM company_overview", Integer.class)).isZero();
    }

    @Test
    @DisplayName("다시 받다 실패하면 저장된 개황을 돌려주고 refreshError에 이유를 담는다")
    void openDartErrorWithStaleCacheServesCache() throws Exception {
        SERVER.on("/api/company.json", Response.json(CompanyJson.SAMSUNG));
        mockMvc.perform(get(OVERVIEW, SAMSUNG)).andExpect(status().isOk());
        ageOverview(8);
        SERVER.on("/api/company.json", Response.json(CompanyJson.status("900", "정의되지 않은 오류가 발생하였습니다.")));

        mockMvc.perform(get(OVERVIEW, SAMSUNG))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.available").value(true))
                .andExpect(jsonPath("$.ceoName").value("전영현, 노태문"))
                .andExpect(jsonPath("$.refreshError").value("DART_REQUEST_FAILED"));
    }
}
