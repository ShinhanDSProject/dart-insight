package com.dartinsight.relateddisclosure.controller;

import static com.dartinsight.dart.client.DisclosureListJson.item;
import static com.dartinsight.dart.client.DisclosureListJson.page;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.domain.TextChangeRow;
import com.dartinsight.analysis.domain.TextChangeRow.Side;
import com.dartinsight.analysis.domain.TextComparison;
import com.dartinsight.analysis.domain.TextStatus;
import com.dartinsight.analysis.repository.AnalysisRepository;
import com.dartinsight.analysis.service.AnalysisResultService;
import com.dartinsight.company.service.CompanyImportService;
import com.dartinsight.comparison.domain.ComparisonBasis;
import com.dartinsight.dart.client.DisclosureListJson;
import com.dartinsight.dart.client.FakeOpenDartServer;
import com.dartinsight.dart.client.FakeOpenDartServer.Response;
import com.dartinsight.dart.domain.CorpCodeEntry;
import com.dartinsight.financial.domain.FsDiv;
import com.dartinsight.report.domain.Correction;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.domain.ReportNameParser.ParsedReportName;
import com.dartinsight.report.domain.ReportType;
import com.dartinsight.report.repository.ReportRepository;
import com.dartinsight.support.TestData;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
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
 * 관련 수시공시 API(#343, docs/api-spec.md). 주요정보는 실제 OpenDART 응답(src/test/resources/opendart/key-items)이고,
 * 공시 목록은 같은 공시의 실제 제목·접수일·비고다.
 */
@SpringBootTest
@AutoConfigureMockMvc
class RelatedDisclosureApiTest {

    private static final FakeOpenDartServer SERVER = startServer();
    private static final String LIST = "/api/list.json";
    private static final String CAPITAL_INCREASE = "/api/piicDecsn.json";
    private static final String LITIGATION = "/api/lwstLg.json";
    private static final String STOCK_ACQUISITION = "/api/otcprStkInvscrInhDecsn.json";
    private static final String LAWSUIT_PATH = "XI. 그 밖에 투자자 보호를 위하여 필요한 사항 > 2. 우발부채 등";
    private static final String CUR = "20260814000001";
    private static final String PREV = "20250814000001";
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 27, 9, 0);

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
    private ReportRepository reportRepository;

    @Autowired
    private AnalysisRepository analysisRepository;

    @Autowired
    private AnalysisResultService resultService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private Long analysisId;

    @BeforeEach
    void setUp() {
        TestData.clearAll(jdbcTemplate);
        companyImportService.save(List.of(
                new CorpCodeEntry("00000001", "예시전자", null, "900001", LocalDate.of(2026, 1, 1))));
        for (int year : new int[] {2025, 2026}) {
            reportRepository.save(Report.create(year == 2026 ? CUR : PREV, "00000001", "반기보고서 (" + year + ".06)",
                    new ParsedReportName(ReportType.HALF, year, LocalDate.of(year, 6, 30), Correction.ORIGINAL),
                    LocalDate.of(year, 8, 14), null, "예시전자", NOW));
        }
        // change_no 1: 신주 수, 2: 소송 원고·사건 명칭(신주 낱말도 있음), 3: 어느 규칙에도 안 걸림
        analysisId = save(analysis());
        resultService.saveAndComplete(analysisId, List.of(), new TextComparison(TextStatus.COMPLETED, null, List.of(
                added("I. 회사의 개요 > 3. 자본금 변동사항", "보고기간 후 보통주 9,900,990주를 발행하였습니다."),
                added(LAWSUIT_PATH, "주식회사 엠제이파트너스가 신주발행무효의 소를 제기하였습니다."),
                added("III. 재무에 관한 사항 > 1. 요약재무정보", "매출이 늘었습니다."))));
        // 소송, 기간 뒤에 정정된 유상증자 원본(비고 '정'). I001·I002는 없다
        SERVER.on(LIST,
                Response.json(page(1, 1,
                        item("20260108000598", "주요사항보고서(소송등의제기)", "20260108", ""),
                        item("20260630000676", "주요사항보고서(유상증자결정)", "20260630", "정"))),
                Response.json(DisclosureListJson.NO_DATA),
                Response.json(DisclosureListJson.NO_DATA));
        SERVER.on(CAPITAL_INCREASE, fixture("capital-increase-ecoprobm-original-20260630000676"));
        SERVER.on(LITIGATION, fixture("litigation-koreazinc-20260108000598"));
        SERVER.on(STOCK_ACQUISITION, Response.json(DisclosureListJson.NO_DATA));
    }

    private static TextChangeRow added(String sectionPath, String text) {
        return new TextChangeRow(TextChangeRow.ADDED, "PARAGRAPH", false, "MATCHED", "제목", sectionPath, null,
                new Side(CUR, 5, 1, text), null, null);
    }

    private static Response fixture(String name) {
        String file = "/opendart/key-items/" + name + ".json";
        try (InputStream in = RelatedDisclosureApiTest.class.getResourceAsStream(file)) {
            if (in == null) {
                throw new IllegalStateException("테스트 자료가 없습니다: " + file);
            }
            return Response.json(new String(in.readAllBytes(), StandardCharsets.UTF_8));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static Analysis analysis() {
        Analysis analysis = Analysis.request("00000001", CUR, PREV, ComparisonBasis.YOY, null, NOW);
        analysis.start(NOW);
        analysis.recordFsDiv(FsDiv.CFS);
        return analysis;
    }

    private Long save(Analysis analysis) {
        return analysisRepository.save(analysis).getId();
    }

    private long changeId(int changeNo) {
        Long id = jdbcTemplate.queryForObject("SELECT id FROM text_change WHERE analysis_id = ? AND change_no = ?",
                Long.class, analysisId, changeNo);
        assertThat(id).isNotNull();
        return id;
    }

    private String path(long changeId) {
        return path(analysisId, changeId);
    }

    private static String path(long analysisId, long changeId) {
        return "/api/analyses/" + analysisId + "/text-changes/" + changeId + "/related-disclosures";
    }

    private int count(String table) {
        Integer n = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM " + table, Integer.class);
        return n == null ? 0 : n;
    }

    @Test
    @DisplayName("찾으면 내용 일치를 먼저 주고, 정정된 원본은 최신 정정본 접수번호로 링크를 연다")
    void foundListsStrongFirstWithLatestCorrectionLink() throws Exception {
        mockMvc.perform(get(path(changeId(2))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.analysisId").value(analysisId))
                .andExpect(jsonPath("$.changeId").value(changeId(2)))
                .andExpect(jsonPath("$.status").value("FOUND"))
                .andExpect(jsonPath("$.unavailableReason").value(nullValue()))
                .andExpect(jsonPath("$.partial").value(false))
                .andExpect(jsonPath("$.window.from").value("2025-06-30"))
                .andExpect(jsonPath("$.window.periodEnd").value("2026-06-30"))
                .andExpect(jsonPath("$.window.to").value("2026-08-14"))
                .andExpect(jsonPath("$.ruleVersion").value("related-2"))
                .andExpect(jsonPath("$.computedAt").value(notNullValue()))
                .andExpect(jsonPath("$.cached").value(false))
                .andExpect(jsonPath("$.items", hasSize(2)))
                // 접수일은 유상증자(06-30)가 최근이지만 내용 일치(소송)가 먼저다
                .andExpect(jsonPath("$.items[0].rceptNo").value("20260108000598"))
                .andExpect(jsonPath("$.items[0].latestRceptNo").value("20260108000598"))
                .andExpect(jsonPath("$.items[0].reportName").value("주요사항보고서(소송등의제기)"))
                .andExpect(jsonPath("$.items[0].receivedDate").value("2026-01-08"))
                .andExpect(jsonPath("$.items[0].disclosureType").value("B001"))
                .andExpect(jsonPath("$.items[0].timing").value("DURING"))
                .andExpect(jsonPath("$.items[0].matchRule").value("litigation"))
                .andExpect(jsonPath("$.items[0].matchRuleLabel").value("소송"))
                .andExpect(jsonPath("$.items[0].matchLevel").value("STRONG"))
                .andExpect(jsonPath("$.items[0].matchedFields", contains("PLAINTIFF", "CASE_NAME")))
                .andExpect(jsonPath("$.items[0].remarks").value(nullValue()))
                .andExpect(jsonPath("$.items[0].dartUrl").value(
                        "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260108000598"))
                .andExpect(jsonPath("$.items[1].rceptNo").value("20260630000676"))
                .andExpect(jsonPath("$.items[1].latestRceptNo").value("20261013000198"))
                .andExpect(jsonPath("$.items[1].matchRule").value("equity-financing"))
                .andExpect(jsonPath("$.items[1].matchRuleLabel").value("자본 조달"))
                .andExpect(jsonPath("$.items[1].matchLevel").value("TYPE_ONLY"))
                .andExpect(jsonPath("$.items[1].matchedFields", hasSize(0)))
                .andExpect(jsonPath("$.items[1].remarks").value("정"))
                .andExpect(jsonPath("$.items[1].dartUrl").value(
                        "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20261013000198"))
                .andExpect(jsonPath("$.notice").value("같은 기간에 공개된 관련 공시입니다. 변경의 원인을 뜻하지 않습니다."));
    }

    @Test
    @DisplayName("두 번째 요청부터는 OpenDART를 부르지 않고 저장된 결과를 준다(다른 변경도 같은 계산을 쓴다)")
    void secondRequestUsesSavedResult() throws Exception {
        mockMvc.perform(get(path(changeId(1)))).andExpect(status().isOk());
        int calls = SERVER.requests().size();

        mockMvc.perform(get(path(changeId(1))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cached").value(true))
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].matchLevel").value("STRONG"))
                .andExpect(jsonPath("$.items[0].matchedFields", contains("NEW_SHARES")));
        mockMvc.perform(get(path(changeId(2))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cached").value(true))
                .andExpect(jsonPath("$.items", hasSize(2)));
        assertThat(SERVER.requests()).hasSize(calls);
        assertThat(count("related_disclosure_run")).isEqualTo(1);
    }

    @Test
    @DisplayName("이 변경에 연결된 공시가 없으면 NOT_FOUND이고 빈 배열이다")
    void notFoundHasEmptyItems() throws Exception {
        mockMvc.perform(get(path(changeId(3))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NOT_FOUND"))
                .andExpect(jsonPath("$.items", hasSize(0)))
                .andExpect(jsonPath("$.cached").value(false));
    }

    @Test
    @DisplayName("공시 목록을 받지 못하면 200 UNAVAILABLE과 사유를 주고 저장하지 않으며, 다음 요청에서 다시 받는다")
    void listFailureIsUnavailableAndRetried() throws Exception {
        SERVER.on(LIST, Response.json(DisclosureListJson.RATE_LIMITED));

        mockMvc.perform(get(path(changeId(2))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UNAVAILABLE"))
                .andExpect(jsonPath("$.unavailableReason").value("DART_RATE_LIMITED"))
                .andExpect(jsonPath("$.partial").value(false))
                .andExpect(jsonPath("$.window.from").value("2025-06-30"))
                .andExpect(jsonPath("$.ruleVersion").value("related-2"))
                .andExpect(jsonPath("$.computedAt").value(notNullValue()))
                .andExpect(jsonPath("$.cached").value(false))
                .andExpect(jsonPath("$.items", hasSize(0)))
                .andExpect(jsonPath("$.notice").value(notNullValue()));
        assertThat(count("related_disclosure_run")).isZero();

        SERVER.on(LIST,
                Response.json(page(1, 1, item("20260108000598", "주요사항보고서(소송등의제기)", "20260108", ""))),
                Response.json(DisclosureListJson.NO_DATA),
                Response.json(DisclosureListJson.NO_DATA));
        mockMvc.perform(get(path(changeId(2))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("FOUND"))
                .andExpect(jsonPath("$.items", hasSize(1)));
        assertThat(count("related_disclosure_run")).isEqualTo(1);
    }

    @Test
    @DisplayName("주요정보를 받지 못하면 partial true로 같은 종류만 주고 저장하지 않는다")
    void keyItemFailureIsPartial() throws Exception {
        SERVER.on(LITIGATION, Response.json(DisclosureListJson.RATE_LIMITED));

        mockMvc.perform(get(path(changeId(2))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("FOUND"))
                .andExpect(jsonPath("$.partial").value(true))
                .andExpect(jsonPath("$.cached").value(false))
                .andExpect(jsonPath("$.items[*].matchLevel", contains("TYPE_ONLY", "TYPE_ONLY")))
                // 같은 종류끼리는 접수일이 최근인 것이 먼저다
                .andExpect(jsonPath("$.items[*].rceptNo", contains("20260630000676", "20260108000598")))
                .andExpect(jsonPath("$.items[0].latestRceptNo").value("20260630000676"));
        assertThat(count("related_disclosure_run")).isZero();
    }

    @Test
    @DisplayName("없는 분석·이 분석의 것이 아닌 변경은 404, 끝나지 않은 분석은 409이고 OpenDART를 부르지 않는다")
    void notFoundAndNotReadyErrors() throws Exception {
        long change = changeId(1);
        Long running = save(analysis());
        int calls = SERVER.requests().size();

        mockMvc.perform(get(path(999_999L, change)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ANALYSIS_NOT_FOUND"))
                .andExpect(jsonPath("$.message").value(notNullValue()))
                .andExpect(jsonPath("$.traceId").value(notNullValue()));
        mockMvc.perform(get(path(999_999L)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ANALYSIS_TEXT_CHANGE_NOT_FOUND"));
        mockMvc.perform(get(path(running, change)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ANALYSIS_NOT_READY"));
        assertThat(SERVER.requests()).hasSize(calls);
    }
}
