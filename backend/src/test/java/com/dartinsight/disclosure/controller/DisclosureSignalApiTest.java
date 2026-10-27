package com.dartinsight.disclosure.controller;

import static com.dartinsight.dart.client.DisclosureListJson.item;
import static com.dartinsight.dart.client.DisclosureListJson.page;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItems;
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

/** 회사와 공시는 모두 가짜다. 감사의견 응답 모양은 2026-10-27 실제 응답(레드우즈 20260407001696)과 같다. */
@SpringBootTest
@AutoConfigureMockMvc
class DisclosureSignalApiTest {

    private static final FakeOpenDartServer SERVER = startServer();
    private static final String PATH = "/api/companies/00000001/disclosure-signals";
    private static final String LIST = "/api/list.json";
    private static final String AUDIT = "/api/accnutAdtorNmNdAdtOpinion.json";
    private static final String ANNUAL_RCEPT_NO = "20260320000001";
    private static final String NO_DATA = "{\"status\":\"013\",\"message\":\"조회된 데이타가 없습니다.\"}";

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

    private static String auditRow(String term, String auditor, String opinion) {
        return """
                {"rcept_no":"%s","corp_cls":"K","corp_code":"00000001","corp_name":"예시전자","bsns_year":"%s",
                 "adtor":"%s","adt_opinion":"%s","adt_reprt_spcmnt_matter":"-","emphs_matter":"-",
                 "core_adt_matter":"-","stlm_dt":"2025-12-31"}
                """.formatted(ANNUAL_RCEPT_NO, term, auditor, opinion);
    }

    private static String auditPage(String... rows) {
        return "{\"status\":\"000\",\"message\":\"정상\",\"list\":[" + String.join(",", rows) + "]}";
    }

    /** 당기 감사인이 바뀌고 감사의견이 의견거절인 사업보고서(연결·별도로 같은 행이 두 번) */
    private static String changedAuditor() {
        return auditPage(
                auditRow("제16기\\n(당기)", "나회계법인", "의견거절"),
                auditRow("제16기\\n(당기)", "나회계법인", "의견거절"),
                auditRow("제15기\\n(전기)", "가회계법인", "적정의견"),
                auditRow("제15기\\n(전기)", "가회계법인", "적정의견"),
                auditRow("제14기\\n(전전기)", "가회계법인", "적정의견"));
    }

    private void answerList() {
        SERVER.on(LIST, Response.json(page(1, 1,
                item("20261020900001", "최대주주변경", daysAgo(7), "코"),
                item("20261001000001", "[기재정정]주요사항보고서(전환사채권발행결정)", daysAgo(26), "코"),
                item("20260901000001", "주요사항보고서(유상증자결정)(자회사의 주요경영사항)", daysAgo(56), "코"),
                item("20260801900001", "소송등의제기ㆍ신청(일정금액이상의청구)", daysAgo(87), "코"),
                item("20260701900001", "소송등의판결ㆍ결정", daysAgo(118), "코"),
                item(ANNUAL_RCEPT_NO, "사업보고서 (2025.12)", daysAgo(221), "코"),
                item("20260310900001", "임원ㆍ주요주주특정증권등소유상황보고서", daysAgo(231), ""))));
    }

    private long calls(String path) {
        return SERVER.requests().stream().filter(r -> r.startsWith(path)).count();
    }

    @Test
    @DisplayName("최근 1년 공시를 종류·사실 문장·원문 링크와 함께 접수일 순으로 돌려주고 종류별 건수를 센다")
    void listsSignalsWithCountsNewestFirst() throws Exception {
        answerList();
        SERVER.on(AUDIT, Response.json(changedAuditor()));

        mockMvc.perform(get(PATH))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.corpCode").value("00000001"))
                .andExpect(jsonPath("$.from").value(iso(365)))
                .andExpect(jsonPath("$.to").value(iso(0)))
                .andExpect(jsonPath("$.kinds", hasSize(8)))
                .andExpect(jsonPath("$.kinds[0].kind").value("LARGEST_SHAREHOLDER_CHANGE"))
                .andExpect(jsonPath("$.kinds[0].label").value("최대주주 변경"))
                .andExpect(jsonPath("$.kinds[0].status").value("CHECKED"))
                .andExpect(jsonPath("$.kinds[0].count").value(1))
                .andExpect(jsonPath("$.kinds[1].kind").value("CAPITAL_INCREASE"))
                .andExpect(jsonPath("$.kinds[1].count").value(0))
                .andExpect(jsonPath("$.kinds[2].kind").value("CONVERTIBLE_BOND"))
                .andExpect(jsonPath("$.kinds[2].count").value(1))
                .andExpect(jsonPath("$.kinds[3].kind").value("BOND_WITH_WARRANT"))
                .andExpect(jsonPath("$.kinds[3].count").value(0))
                .andExpect(jsonPath("$.kinds[4].kind").value("LITIGATION"))
                .andExpect(jsonPath("$.kinds[4].count").value(1))
                .andExpect(jsonPath("$.kinds[5].kind").value("REHABILITATION_LISTING"))
                .andExpect(jsonPath("$.kinds[5].count").value(0))
                .andExpect(jsonPath("$.kinds[6].kind").value("AUDITOR_CHANGE"))
                .andExpect(jsonPath("$.kinds[6].status").value("CHECKED"))
                .andExpect(jsonPath("$.kinds[6].count").value(1))
                .andExpect(jsonPath("$.kinds[7].kind").value("NON_CLEAN_AUDIT_OPINION"))
                .andExpect(jsonPath("$.kinds[7].label").value("감사의견(적정이 아님)"))
                .andExpect(jsonPath("$.kinds[7].count").value(1))
                .andExpect(jsonPath("$.items", hasSize(5)))
                .andExpect(jsonPath("$.items[0].kind").value("LARGEST_SHAREHOLDER_CHANGE"))
                .andExpect(jsonPath("$.items[0].rceptNo").value("20261020900001"))
                .andExpect(jsonPath("$.items[0].reportName").value("최대주주변경"))
                .andExpect(jsonPath("$.items[0].receivedDate").value(iso(7)))
                .andExpect(jsonPath("$.items[0].sentence").value("최대주주가 바뀌었다고 공시했어요."))
                .andExpect(jsonPath("$.items[0].dartUrl")
                        .value("https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20261020900001"))
                .andExpect(jsonPath("$.items[1].kind").value("CONVERTIBLE_BOND"))
                .andExpect(jsonPath("$.items[1].reportName").value("[기재정정]주요사항보고서(전환사채권발행결정)"))
                .andExpect(jsonPath("$.items[1].sentence").value("전환사채 발행을 결정했다고 공시했어요."))
                .andExpect(jsonPath("$.items[2].kind").value("LITIGATION"))
                .andExpect(jsonPath("$.items[2].sentence").value("소송 등이 제기됐다고 공시했어요."))
                .andExpect(jsonPath("$.items[3].rceptNo").value(ANNUAL_RCEPT_NO))
                .andExpect(jsonPath("$.items[3].reportName").value("사업보고서 (2025.12)"))
                .andExpect(jsonPath("$.items[4].rceptNo").value(ANNUAL_RCEPT_NO))
                .andExpect(jsonPath("$.items[*].sentence").value(hasItems(
                        "사업보고서에 적힌 감사인이 제15기(전기) 가회계법인에서 제16기(당기) 나회계법인으로 바뀌었어요.",
                        "사업보고서에 적힌 제16기(당기) 감사의견은 '의견거절'이에요.")))
                .andExpect(jsonPath("$.items[3].dartUrl")
                        .value("https://dart.fss.or.kr/dsaf001/main.do?rcpNo=" + ANNUAL_RCEPT_NO));

        assertThat(SERVER.requests()).anyMatch(r -> r.startsWith(AUDIT) && r.contains("bsns_year=2025")
                && r.contains("reprt_code=11011") && r.contains("corp_code=00000001"));
    }

    @Test
    @DisplayName("감사의견은 사업보고서마다 저장해 다시 부르지 않는다")
    void savesAuditOpinionPerReport() throws Exception {
        answerList();
        SERVER.on(AUDIT, Response.json(changedAuditor()));
        mockMvc.perform(get(PATH)).andExpect(status().isOk());
        long before = calls(AUDIT);

        mockMvc.perform(get(PATH))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kinds[6].count").value(1));

        assertThat(calls(AUDIT)).isEqualTo(before);
        assertThat(jdbcTemplate.queryForObject("SELECT status FROM disclosure_audit_opinion WHERE rcept_no = ?",
                String.class, ANNUAL_RCEPT_NO)).isEqualTo("OK");
    }

    @Test
    @DisplayName("사업보고서제출기한연장신고서는 사업보고서로 보지 않아 감사의견 확인을 막지 않는다")
    void extensionNoticeIsNotAnAnnualReport() throws Exception {
        SERVER.on(LIST, Response.json(page(1, 1,
                item("20260320900001", "사업보고서제출기한연장신고서 (2025.12)", daysAgo(200), ""))));

        mockMvc.perform(get(PATH))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kinds[?(@.status == 'CHECKED')]", hasSize(8)));
    }

    @Test
    @DisplayName("해당 공시가 없으면 모든 종류가 확인함·0건이고 기간을 돌려준다")
    void emptyWhenNothingMatches() throws Exception {
        long before = calls(AUDIT);
        SERVER.on(LIST, Response.json(page(1, 1,
                item("20261020900001", "임원ㆍ주요주주특정증권등소유상황보고서", daysAgo(7), ""))));

        mockMvc.perform(get(PATH))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.from").value(iso(365)))
                .andExpect(jsonPath("$.items", hasSize(0)))
                .andExpect(jsonPath("$.kinds[?(@.status == 'CHECKED')]", hasSize(8)))
                .andExpect(jsonPath("$.kinds[?(@.count == 0)]", hasSize(8)));

        assertThat(calls(AUDIT)).isEqualTo(before);
    }

    @Test
    @DisplayName("감사의견을 받지 못하면 감사 두 종류만 확인하지 못함이고 건수는 null이다")
    void auditFailureOnlyMarksAuditKinds() throws Exception {
        answerList();
        SERVER.on(AUDIT, Response.json(DisclosureListJson.RATE_LIMITED));

        mockMvc.perform(get(PATH))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kinds[0].status").value("CHECKED"))
                .andExpect(jsonPath("$.kinds[0].count").value(1))
                .andExpect(jsonPath("$.kinds[6].status").value("UNAVAILABLE"))
                .andExpect(jsonPath("$.kinds[6].count").value(nullValue()))
                .andExpect(jsonPath("$.kinds[7].status").value("UNAVAILABLE"))
                .andExpect(jsonPath("$.kinds[7].count").value(nullValue()))
                .andExpect(jsonPath("$.items", hasSize(3)));

        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM disclosure_audit_opinion", Integer.class))
                .isZero();
    }

    @Test
    @DisplayName("감사의견 자료가 없으면(013) 확인함·0건으로 두고, 정한 시간이 지나면 한 번 더 받는다")
    void noAuditDataIsCheckedAndRefetchedLater() throws Exception {
        answerList();
        SERVER.on(AUDIT, Response.json(NO_DATA));

        mockMvc.perform(get(PATH))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kinds[6].status").value("CHECKED"))
                .andExpect(jsonPath("$.kinds[6].count").value(0))
                .andExpect(jsonPath("$.kinds[7].count").value(0));
        long before = calls(AUDIT);
        mockMvc.perform(get(PATH)).andExpect(status().isOk());
        assertThat(calls(AUDIT)).isEqualTo(before);

        jdbcTemplate.update("UPDATE disclosure_audit_opinion SET fetched_at = ?",
                Timestamp.valueOf(LocalDateTime.now(clock).minusHours(2)));
        SERVER.on(AUDIT, Response.json(changedAuditor()));
        mockMvc.perform(get(PATH))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kinds[6].count").value(1));
        assertThat(calls(AUDIT)).isEqualTo(before + 1);
    }

    @Test
    @DisplayName("공시 목록을 받지 못하고 저장된 목록도 없으면 모든 종류가 확인하지 못함이다")
    void listFailureMarksAllKinds() throws Exception {
        SERVER.on(LIST, Response.status(500));

        mockMvc.perform(get(PATH))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.from").value(iso(365)))
                .andExpect(jsonPath("$.kinds[?(@.status == 'UNAVAILABLE')]", hasSize(8)))
                .andExpect(jsonPath("$.items", hasSize(0)));
    }

    @Test
    @DisplayName("12월 결산이 아닌 사업보고서는 사업연도를 정하지 않아 감사 두 종류를 확인하지 못함으로 둔다")
    void nonDecemberAnnualReportIsUnavailable() throws Exception {
        long before = calls(AUDIT);
        SERVER.on(LIST, Response.json(page(1, 1,
                item("20260620000001", "사업보고서 (2026.03)", daysAgo(130), "유"))));

        mockMvc.perform(get(PATH))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kinds[0].status").value("CHECKED"))
                .andExpect(jsonPath("$.kinds[6].status").value("UNAVAILABLE"))
                .andExpect(jsonPath("$.kinds[7].status").value("UNAVAILABLE"));

        assertThat(calls(AUDIT)).isEqualTo(before);
    }

    @Test
    @DisplayName("없는 고유번호는 404 COMPANY_NOT_FOUND")
    void unknownCompanyIsNotFound() throws Exception {
        mockMvc.perform(get("/api/companies/99999999/disclosure-signals"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COMPANY_NOT_FOUND"));
    }
}
