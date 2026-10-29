package com.dartinsight.community.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dartinsight.aiserver.client.FakeAiServer;
import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.domain.CalcStatus;
import com.dartinsight.analysis.domain.FinancialChangeRow;
import com.dartinsight.analysis.domain.FinancialChangeRow.Evidence;
import com.dartinsight.analysis.domain.TextChangeRow;
import com.dartinsight.analysis.domain.TextChangeRow.Side;
import com.dartinsight.analysis.domain.TextComparison;
import com.dartinsight.analysis.domain.TextStatus;
import com.dartinsight.analysis.repository.AnalysisRepository;
import com.dartinsight.analysis.service.AnalysisResultService;
import com.dartinsight.company.service.CompanyImportService;
import com.dartinsight.comparison.domain.AmountBasis;
import com.dartinsight.comparison.domain.ComparisonBasis;
import com.dartinsight.dart.client.FakeOpenDartServer;
import com.dartinsight.dart.domain.CorpCodeEntry;
import com.dartinsight.financial.domain.FsDiv;
import com.dartinsight.report.domain.Correction;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.domain.ReportNameParser.ParsedReportName;
import com.dartinsight.report.domain.ReportType;
import com.dartinsight.report.repository.ReportRepository;
import com.dartinsight.support.TestData;
import com.jayway.jsonpath.JsonPath;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** 커뮤니티 글의 변경점 인용(6.6 #464): backend가 만든 사본만 저장, 다른 기업·없는 변경은 400, 가린 글의 인용 */
@SpringBootTest
@AutoConfigureMockMvc
class CommunityQuoteApiTest {
    private static final FakeOpenDartServer DART = startDart();
    private static final FakeAiServer AI = new FakeAiServer();
    private static final String PASSWORD = "Sample!password";
    private static final String CORP = "00000001";
    private static final String OTHER_CORP = "00000002";
    private static final String POSTS = "/api/companies/" + CORP + "/posts";
    private static final String CUR = "20260814000001";
    private static final String PREV = "20250814000001";
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 21, 9, 0);

    @DynamicPropertySource
    static void servers(DynamicPropertyRegistry registry) {
        registry.add("app.opendart.base-url", DART::baseUrl);
        registry.add("app.ai-server.base-url", AI::baseUrl);
    }

    private static FakeOpenDartServer startDart() {
        try {
            return new FakeOpenDartServer();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired CompanyImportService companyImportService;
    @Autowired ReportRepository reportRepository;
    @Autowired AnalysisRepository analysisRepository;
    @Autowired AnalysisResultService resultService;

    private long analysisId;
    private String alice;

    @BeforeEach
    void setUp() throws Exception {
        clear();
        companyImportService.save(List.of(
                new CorpCodeEntry(CORP, "예시전자", null, "900001", LocalDate.of(2026, 1, 1)),
                new CorpCodeEntry(OTHER_CORP, "다른기업", null, null, LocalDate.of(2026, 1, 1))));
        for (int year : new int[] {2025, 2026}) {
            reportRepository.save(Report.create(year == 2026 ? CUR : PREV, CORP, "반기보고서 (" + year + ".06)",
                    new ParsedReportName(ReportType.HALF, year, LocalDate.of(year, 6, 30), Correction.ORIGINAL),
                    LocalDate.of(year, 8, 14), null, "예시전자", NOW));
        }
        Analysis analysis = Analysis.request(CORP, CUR, PREV, ComparisonBasis.YOY, null, NOW);
        analysis.start(NOW);
        analysisId = analysisRepository.save(analysis).getId();
        resultService.saveAndComplete(analysisId, List.of(
                new FinancialChangeRow("IS", FsDiv.CFS, "ifrs-full_Revenue", "매출액", 0, AmountBasis.CUMULATIVE,
                        1_000_000L, 1_200_000L, 200_000L, new BigDecimal("0.200000"), CalcStatus.OK, "KRW",
                        new Evidence(PREV, "IS", "ifrs-full_Revenue", "매출액", "제 56 기 반기"),
                        new Evidence(CUR, "IS", "ifrs-full_Revenue", "매출액", "제 57 기 반기"))),
                new TextComparison(TextStatus.COMPLETED, null, List.of(
                        new TextChangeRow(TextChangeRow.MODIFIED, "PARAGRAPH", false, "MATCHED", "1. 사업의 개요",
                                "II. 사업의 내용 > 1. 사업의 개요", new Side(PREV, 2, 1, "당사는 메모리를 만듭니다."),
                                new Side(CUR, 2, 1, "당사는 메모리와 파운드리를 만듭니다."), new BigDecimal("0.7000"),
                                null))));
        alice = signIn("alice@example.com", "반도체공부중");
    }

    // 회원·기업 표를 지우는 다른 테스트가 외래 키에 걸리지 않게 끝날 때도 지운다
    @AfterEach
    void clear() {
        TestData.clearAll(jdbc);
        jdbc.update("DELETE FROM refresh_token");
        jdbc.update("DELETE FROM social_account");
        jdbc.update("DELETE FROM local_credential");
        jdbc.update("DELETE FROM app_user");
    }

    @Test
    @DisplayName("문장 변경을 붙이면 섹션 경로·변경 유형·보고서 쌍·원래 위치가 저장된 분석 결과로 만든 사본으로 나온다")
    void quotesTextChangeFromStoredResult() throws Exception {
        long changeId = textChangeId();
        long postId = postId(writePost(alice, quote("TEXT_CHANGE", analysisId, changeId))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.quote.kind").value("TEXT_CHANGE"))
                .andExpect(jsonPath("$.quote.label").value("II. 사업의 내용 > 1. 사업의 개요"))
                .andExpect(jsonPath("$.quote.text").value("당사는 메모리와 파운드리를 만듭니다."))
                .andExpect(jsonPath("$.quote.changeType").value("MODIFIED"))
                .andExpect(jsonPath("$.quote.sjDiv").isEmpty())
                .andExpect(jsonPath("$.quote.reportPair.previous").value("반기보고서 (2025.06)"))
                .andExpect(jsonPath("$.quote.reportPair.current").value("반기보고서 (2026.06)"))
                .andExpect(jsonPath("$.quote.source.analysisId").value(analysisId))
                .andExpect(jsonPath("$.quote.source.changeId").value(changeId))
                .andExpect(jsonPath("$.quote.source.rceptNo").value(CUR))
                .andExpect(jsonPath("$.quote.source.sectionNo").value(2))
                .andExpect(jsonPath("$.quote.source.blockNo").value(1))
                .andExpect(jsonPath("$.quote.outdated").value(false)));

        mvc.perform(get(POSTS))
                .andExpect(jsonPath("$.items[0].quote.label").value("II. 사업의 내용 > 1. 사업의 개요"));
        mvc.perform(get("/api/posts/" + postId))
                .andExpect(jsonPath("$.post.quote.source.changeId").value(changeId));
    }

    @Test
    @DisplayName("재무 계정 변화를 붙이면 '재무제표 · 계정명'과 코드가 만든 값 문장, 재무제표 종류가 나온다")
    void quotesFinancialChange() throws Exception {
        writePost(alice, quote("FINANCIAL_CHANGE", analysisId, financialChangeId()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.quote.kind").value("FINANCIAL_CHANGE"))
                .andExpect(jsonPath("$.quote.label").value("손익계산서 · 매출액"))
                .andExpect(jsonPath("$.quote.text").value("이전 1,000,000원 → 현재 1,200,000원, 증감 +200,000원(+20.0%)"))
                .andExpect(jsonPath("$.quote.sjDiv").value("IS"))
                .andExpect(jsonPath("$.quote.changeType").isEmpty())
                .andExpect(jsonPath("$.quote.source.sectionNo").isEmpty());
    }

    @Test
    @DisplayName("화면이 이름·글을 보내도 쓰지 않고 backend가 만든 사본만 저장한다")
    void ignoresClientSnapshot() throws Exception {
        String body = "{\"body\":\"의견\",\"quote\":{\"kind\":\"TEXT_CHANGE\",\"analysisId\":" + analysisId
                + ",\"changeId\":" + textChangeId() + ",\"label\":\"가짜 경로\",\"text\":\"매출이 10배 늘었다\"}}";
        mvc.perform(withToken(post(POSTS), alice).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.quote.label").value("II. 사업의 내용 > 1. 사업의 개요"));
        assertThat(jdbc.queryForObject("SELECT snapshot_text FROM community_quote", String.class))
                .isEqualTo("당사는 메모리와 파운드리를 만듭니다.");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM community_quote WHERE snapshot_label = '가짜 경로'"
                + " OR snapshot_text LIKE '%10배%'", Integer.class)).isZero();
    }

    @Test
    @DisplayName("다른 기업의 분석이면 400(quote.analysisId)이고 글도 인용도 저장하지 않는다")
    void rejectsOtherCompanyAnalysis() throws Exception {
        mvc.perform(withToken(post("/api/companies/" + OTHER_CORP + "/posts"), alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(quote("TEXT_CHANGE", analysisId, textChangeId())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"))
                .andExpect(jsonPath("$.errors[0].field").value("quote.analysisId"));
        assertNothingSaved();
    }

    @Test
    @DisplayName("없는 분석은 quote.analysisId, 그 분석의 변경이 아니거나 종류가 다르면 quote.changeId로 400이다")
    void rejectsUnknownAnalysisOrChange() throws Exception {
        writePost(alice, quote("TEXT_CHANGE", analysisId + 999, textChangeId()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("quote.analysisId"));
        writePost(alice, quote("TEXT_CHANGE", analysisId, textChangeId() + 999))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("quote.changeId"));
        // 문장 변경 ID를 재무 계정 변화로 보내면 그 분석의 재무 변경이 아니다
        writePost(alice, quote("FINANCIAL_CHANGE", analysisId, textChangeId() + 999))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("quote.changeId"));
        assertNothingSaved();
    }

    @Test
    @DisplayName("끝나지 않은 분석은 400(quote.analysisId)이다")
    void rejectsUnfinishedAnalysis() throws Exception {
        Analysis running = Analysis.request(CORP, CUR, PREV, ComparisonBasis.PREV, null, NOW);
        running.start(NOW);
        long runningId = analysisRepository.save(running).getId();
        writePost(alice, quote("TEXT_CHANGE", runningId, textChangeId()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("quote.analysisId"));
        assertNothingSaved();
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "\"문장\"",
        "{\"kind\":\"ANSWER_CITATION\",\"analysisId\":1,\"changeId\":1}",
        "{\"kind\":\"TEXT_CHANGE\",\"analysisId\":\"1\",\"changeId\":1}",
        "{\"kind\":\"TEXT_CHANGE\",\"analysisId\":1,\"changeId\":1.5}",
        "{\"kind\":\"TEXT_CHANGE\",\"analysisId\":1}"
    })
    @DisplayName("인용 모양이 잘못되면 400이고 저장하지 않는다")
    void rejectsMalformedQuote(String quoteJson) throws Exception {
        mvc.perform(withToken(post(POSTS), alice).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"의견\",\"quote\":" + quoteJson + "}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"));
        assertNothingSaved();
    }

    @Test
    @DisplayName("글을 고쳐도 인용은 그대로이고, 가려진 글의 인용은 작성자에게만 보인다")
    void quoteStaysOnEditAndHidesWhenBlinded() throws Exception {
        long postId = postId(writePost(alice, quote("TEXT_CHANGE", analysisId, textChangeId())));
        mvc.perform(withToken(patch("/api/posts/" + postId), alice).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"고친 의견\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.quote.text").value("당사는 메모리와 파운드리를 만듭니다."));

        jdbc.update("UPDATE community_post SET status = 'BLINDED' WHERE id = ?", postId);
        mvc.perform(get("/api/posts/" + postId)).andExpect(jsonPath("$.post.quote").isEmpty());
        mvc.perform(withToken(get("/api/posts/" + postId), alice))
                .andExpect(jsonPath("$.post.quote.kind").value("TEXT_CHANGE"));
    }

    @Test
    @DisplayName("담을 때의 분석 버전이 지금 버전과 다르면 outdated다")
    void flagsOutdatedVersion() throws Exception {
        writePost(alice, quote("TEXT_CHANGE", analysisId, textChangeId()));
        jdbc.update("UPDATE community_quote SET analysis_version = 'm1-old'");
        mvc.perform(get(POSTS)).andExpect(jsonPath("$.items[0].quote.outdated").value(true));
    }

    private void assertNothingSaved() {
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM community_post", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM community_quote", Integer.class)).isZero();
    }

    private static String quote(String kind, long analysis, long change) {
        return "{\"body\":\"HBM 문장이 새로 들어갔네요.\",\"quote\":{\"kind\":\"" + kind + "\",\"analysisId\":"
                + analysis + ",\"changeId\":" + change + "}}";
    }

    private ResultActions writePost(String token, String json) throws Exception {
        return mvc.perform(withToken(post(POSTS), token).contentType(MediaType.APPLICATION_JSON).content(json));
    }

    private static MockHttpServletRequestBuilder withToken(MockHttpServletRequestBuilder request, String token) {
        return request.header("Authorization", "Bearer " + token);
    }

    private static long postId(ResultActions result) throws Exception {
        return ((Number) JsonPath.read(result.andReturn().getResponse().getContentAsString(), "$.postId"))
                .longValue();
    }

    private long financialChangeId() {
        return jdbc.queryForObject("SELECT id FROM financial_change WHERE analysis_id = ?", Long.class, analysisId);
    }

    private long textChangeId() {
        return jdbc.queryForObject("SELECT id FROM text_change WHERE analysis_id = ?", Long.class, analysisId);
    }

    private String signIn(String email, String nickname) throws Exception {
        String body = "{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}";
        mvc.perform(post("/api/users").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated());
        String login = mvc.perform(post("/api/sessions").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String token = JsonPath.read(login, "$.accessToken");
        mvc.perform(withToken(put("/api/users/current/nickname"), token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"nickname\":\"" + nickname + "\"}")).andExpect(status().isOk());
        return token;
    }
}
