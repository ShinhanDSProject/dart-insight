package com.dartinsight.note.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
import com.dartinsight.dart.domain.CorpCodeEntry;
import com.dartinsight.document.domain.ReportDocument;
import com.dartinsight.document.dto.StructuredDocumentResponse;
import com.dartinsight.document.dto.StructuredDocumentResponse.Block;
import com.dartinsight.document.dto.StructuredDocumentResponse.Section;
import com.dartinsight.document.repository.DocumentStore;
import com.dartinsight.document.repository.ReportDocumentRepository;
import com.dartinsight.financial.domain.FsDiv;
import com.dartinsight.report.domain.Correction;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.domain.ReportNameParser.ParsedReportName;
import com.dartinsight.report.domain.ReportType;
import com.dartinsight.report.repository.ReportRepository;
import com.dartinsight.support.TestData;
import com.jayway.jsonpath.JsonPath;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

/** 내 판단 노트 API(6.5, #413): 로그인, 회원별 분리, 사본, 메모, 버전 안내, 내보내기 */
@SpringBootTest
@AutoConfigureMockMvc
class JudgmentNoteApiTest {
    private static final String PASSWORD = "Sample!password";
    private static final String CORP = "00000001";
    private static final String CUR = "20260814000001";
    private static final String PREV = "20250814000001";
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 21, 9, 0);

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired CompanyImportService companyImportService;
    @Autowired ReportRepository reportRepository;
    @Autowired AnalysisRepository analysisRepository;
    @Autowired AnalysisResultService resultService;
    @Autowired ReportDocumentRepository documentRepository;
    @Autowired DocumentStore documentStore;

    private long analysisId;

    @BeforeEach
    void setUp() {
        clear();
        companyImportService.save(List.of(
                new CorpCodeEntry(CORP, "예시전자", null, "900001", LocalDate.of(2026, 1, 1)),
                new CorpCodeEntry("00000002", "다른기업", null, null, LocalDate.of(2026, 1, 1))));
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
                        new Evidence(CUR, "IS", "ifrs-full_Revenue", "매출액", "제 57 기 반기")),
                new FinancialChangeRow("BS", FsDiv.CFS, "NAME:신규계정", "신규계정", 0, AmountBasis.POINT,
                        null, 50L, null, null, CalcStatus.ONLY_CURRENT, "KRW", null,
                        new Evidence(CUR, "BS", "-표준계정코드 미사용-", "신규계정", "제 57 기 반기"))),
                new TextComparison(TextStatus.COMPLETED, null, List.of(
                        new TextChangeRow(TextChangeRow.MODIFIED, "PARAGRAPH", false, "MATCHED", "1. 사업의 개요",
                                "II. 사업의 내용 > 1. 사업의 개요", new Side(PREV, 2, 1, "당사는 메모리를 만듭니다."),
                                new Side(CUR, 2, 1, "당사는 메모리와 파운드리를 만듭니다."), new BigDecimal("0.7000"),
                                null),
                        new TextChangeRow(TextChangeRow.DELETED, "PARAGRAPH", false, "MATCHED", "1. 사업의 개요",
                                "II. 사업의 내용 > 1. 사업의 개요", new Side(PREV, 2, 3, "빠진 문단입니다."), null, null,
                                null))));
    }

    // 회원 표를 지우는 다른 테스트가 외래 키에 걸리지 않게 끝날 때도 지운다
    @AfterEach
    void clear() {
        TestData.clearAll(jdbc);
        jdbc.update("DELETE FROM refresh_token");
        jdbc.update("DELETE FROM social_account");
        jdbc.update("DELETE FROM local_credential");
        jdbc.update("DELETE FROM app_user");
    }

    @Test
    @DisplayName("로그인하지 않으면 노트 API를 쓸 수 없고 아무것도 저장하지 않는다")
    void requiresLogin() throws Exception {
        mvc.perform(get("/api/notes"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_UNAUTHORIZED"));
        mvc.perform(post("/api/notes").contentType(MediaType.APPLICATION_JSON).content(financialBody("메모")))
                .andExpect(status().isUnauthorized());
        mvc.perform(put("/api/notes/1/memo").contentType(MediaType.APPLICATION_JSON).content("{\"memo\":\"x\"}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/notes/1")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/notes/export").param("corpCode", CORP)).andExpect(status().isUnauthorized());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM judgment_note_item", Integer.class)).isZero();
    }

    @Test
    @DisplayName("재무 계정 근거를 담으면 저장된 계산 결과로 이름·값 사본과 원래 위치를 남긴다")
    void savesFinancialSnapshotFromStoredResult() throws Exception {
        String token = login("member@example.com");
        long changeId = financialChangeId("매출액");
        mvc.perform(post("/api/notes").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(financialBody("  환율 효과 확인  ")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.itemId").isNumber())
                .andExpect(jsonPath("$.corpCode").value(CORP))
                .andExpect(jsonPath("$.kind").value("FINANCIAL_CHANGE"))
                .andExpect(jsonPath("$.label").value("손익계산서 · 매출액"))
                .andExpect(jsonPath("$.text").value("이전 1,000,000원 → 현재 1,200,000원, 증감 +200,000원(+20.0%)"))
                .andExpect(jsonPath("$.changeType").doesNotExist())
                .andExpect(jsonPath("$.memo").value("환율 효과 확인"))
                .andExpect(jsonPath("$.source.analysisId").value(analysisId))
                .andExpect(jsonPath("$.source.analysisVersion").value(Analysis.CURRENT_VERSION))
                .andExpect(jsonPath("$.source.changeId").value(changeId))
                .andExpect(jsonPath("$.source.sjDiv").value("IS"))
                .andExpect(jsonPath("$.source.rceptNo").value(CUR))
                .andExpect(jsonPath("$.source.dartUrl").value("https://dart.fss.or.kr/dsaf001/main.do?rcpNo=" + CUR))
                .andExpect(jsonPath("$.outdated").value(false))
                .andExpect(jsonPath("$.createdAt").isString());
    }

    @Test
    @DisplayName("계산하지 않은 계정은 없는 값을 0으로 쓰지 않고 사유를 붙인다")
    void writesReasonForUncalculatedAccount() throws Exception {
        String token = login("member@example.com");
        String body = "{\"kind\":\"FINANCIAL_CHANGE\",\"analysisId\":" + analysisId + ",\"changeId\":"
                + financialChangeId("신규계정") + "}";
        mvc.perform(post("/api/notes").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.label").value("재무상태표 · 신규계정"))
                .andExpect(jsonPath("$.text").value("이전 없음 → 현재 50원. 이전 보고서에 없는 계정이라 계산하지 않아요."))
                .andExpect(jsonPath("$.memo").doesNotExist());
    }

    @Test
    @DisplayName("문장 변경을 담으면 섹션 경로와 글, 위치를 남기고 삭제된 문장은 이전 보고서 쪽을 가리킨다")
    void savesTextSnapshot() throws Exception {
        String token = login("member@example.com");
        mvc.perform(post("/api/notes").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(textBody(textChangeId("MODIFIED"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.kind").value("TEXT_CHANGE"))
                .andExpect(jsonPath("$.label").value("II. 사업의 내용 > 1. 사업의 개요"))
                .andExpect(jsonPath("$.text").value("당사는 메모리와 파운드리를 만듭니다."))
                .andExpect(jsonPath("$.changeType").value("MODIFIED"))
                .andExpect(jsonPath("$.source.rceptNo").value(CUR))
                .andExpect(jsonPath("$.source.sectionNo").value(2))
                .andExpect(jsonPath("$.source.blockNo").value(1))
                .andExpect(jsonPath("$.source.sjDiv").doesNotExist());
        mvc.perform(post("/api/notes").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(textBody(textChangeId("DELETED"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.text").value("빠진 문단입니다."))
                .andExpect(jsonPath("$.source.rceptNo").value(PREV))
                .andExpect(jsonPath("$.source.blockNo").value(3));
    }

    @Test
    @DisplayName("요청 값이 잘못되면 400과 필드별 사유를 돌려주고 저장하지 않는다")
    void rejectsInvalidInput() throws Exception {
        String token = login("member@example.com");
        mvc.perform(post("/api/notes").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"analysisId\":0}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"))
                .andExpect(jsonPath("$.errors[*].field", org.hamcrest.Matchers.containsInAnyOrder(
                        "kind", "analysisId")));
        mvc.perform(post("/api/notes").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kind\":\"TEXT_CHANGE\",\"analysisId\":" + analysisId + "}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("changeId"));
        mvc.perform(post("/api/notes").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kind\":\"ANSWER\",\"analysisId\":1,\"changeId\":1}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("kind"))
                .andExpect(jsonPath("$.errors[0].reason").value("허용 값: FINANCIAL_CHANGE, TEXT_CHANGE, ANSWER_CITATION"));
        String longMemo = "가".repeat(1001);
        mvc.perform(post("/api/notes").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(financialBody(longMemo)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("memo"));
        mvc.perform(get("/api/notes").param("corpCode", "abc").header("Authorization", bearer(token)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("corpCode"));
        mvc.perform(get("/api/notes/export").header("Authorization", bearer(token)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("corpCode"));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM judgment_note_item", Integer.class)).isZero();
    }

    @Test
    @DisplayName("이 분석의 근거가 아니거나 없는 분석이면 담지 않는다")
    void rejectsUnknownEvidence() throws Exception {
        String token = login("member@example.com");
        mvc.perform(post("/api/notes").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kind\":\"FINANCIAL_CHANGE\",\"analysisId\":" + analysisId
                                + ",\"changeId\":999999}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ANALYSIS_CHANGE_NOT_FOUND"));
        mvc.perform(post("/api/notes").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kind\":\"TEXT_CHANGE\",\"analysisId\":999999,\"changeId\":1}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ANALYSIS_NOT_FOUND"));
    }

    @Test
    @DisplayName("다른 회원의 노트는 보이지 않고 메모를 고치거나 지울 수 없다")
    void keepsNotesPerUser() throws Exception {
        String mine = login("member@example.com");
        String other = login("other@example.com");
        long itemId = add(mine, financialBody("내 메모"));

        mvc.perform(get("/api/notes").header("Authorization", bearer(other)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.companies", hasSize(0)));
        mvc.perform(put("/api/notes/" + itemId + "/memo").header("Authorization", bearer(other))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"memo\":\"남의 메모\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COMPANY_NOTE_NOT_FOUND"));
        mvc.perform(delete("/api/notes/" + itemId).header("Authorization", bearer(other)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COMPANY_NOTE_NOT_FOUND"));
        mvc.perform(get("/api/notes/export").param("corpCode", CORP).header("Authorization", bearer(other)))
                .andExpect(status().isOk())
                .andExpect(content().string(not(containsString("내 메모"))));

        mvc.perform(get("/api/notes").header("Authorization", bearer(mine)))
                .andExpect(jsonPath("$.companies[0].items[0].memo").value("내 메모"));
    }

    @Test
    @DisplayName("기업별로 묶어 최근 순으로 보이고, corpCode로 한 기업만 거른다")
    void listsByCompany() throws Exception {
        String token = login("member@example.com");
        long first = add(token, financialBody(null));
        long second = add(token, textBody(textChangeId("MODIFIED")));

        mvc.perform(get("/api/notes").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.companies", hasSize(1)))
                .andExpect(jsonPath("$.companies[0].corpCode").value(CORP))
                .andExpect(jsonPath("$.companies[0].corpName").value("예시전자"))
                .andExpect(jsonPath("$.companies[0].items[*].itemId", contains((int) second, (int) first)));
        mvc.perform(get("/api/notes").param("corpCode", "00000002").header("Authorization", bearer(token)))
                .andExpect(jsonPath("$.companies", hasSize(0)));
    }

    @Test
    @DisplayName("메모를 고치면 사본은 그대로이고, 비우면 메모가 지워진다")
    void updatesMemoOnly() throws Exception {
        String token = login("member@example.com");
        long itemId = add(token, financialBody("처음"));
        mvc.perform(put("/api/notes/" + itemId + "/memo").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"memo\":\"고친 메모\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.memo").value("고친 메모"))
                .andExpect(jsonPath("$.text").value("이전 1,000,000원 → 현재 1,200,000원, 증감 +200,000원(+20.0%)"));
        mvc.perform(put("/api/notes/" + itemId + "/memo").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"memo\":\"   \"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.memo").doesNotExist());
        mvc.perform(put("/api/notes/" + itemId + "/memo").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"memo\":\"" + "가".repeat(1001) + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("memo"));
    }

    @Test
    @DisplayName("항목 하나만 지우고 나머지는 남는다")
    void deletesOneItem() throws Exception {
        String token = login("member@example.com");
        long keep = add(token, financialBody("남김"));
        long remove = add(token, financialBody("지움"));
        mvc.perform(delete("/api/notes/" + remove).header("Authorization", bearer(token)))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/notes").header("Authorization", bearer(token)))
                .andExpect(jsonPath("$.companies[0].items[*].itemId", contains((int) keep)));
        mvc.perform(delete("/api/notes/" + remove).header("Authorization", bearer(token)))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("담을 때의 분석 버전이 지금 버전과 다르면 outdated이고 담은 값은 그대로다")
    void flagsOutdatedVersion() throws Exception {
        String token = login("member@example.com");
        jdbc.update("UPDATE analysis SET analysis_version = 'm1-old' WHERE id = ?", analysisId);
        long itemId = add(token, financialBody(null));
        // 담은 뒤 분석 결과의 값이 바뀌어도 사본은 그대로다
        jdbc.update("UPDATE financial_change SET current_amount = 9 WHERE analysis_id = ?", analysisId);

        mvc.perform(get("/api/notes").header("Authorization", bearer(token)))
                .andExpect(jsonPath("$.companies[0].items[0].itemId").value(itemId))
                .andExpect(jsonPath("$.companies[0].items[0].outdated").value(true))
                .andExpect(jsonPath("$.companies[0].items[0].source.analysisVersion").value("m1-old"))
                .andExpect(jsonPath("$.companies[0].items[0].text")
                        .value("이전 1,000,000원 → 현재 1,200,000원, 증감 +200,000원(+20.0%)"));
        mvc.perform(get("/api/notes/export").param("corpCode", CORP).header("Authorization", bearer(token)))
                .andExpect(content().string(containsString("분석 방식이 바뀌어 위치가 달라졌을 수 있어요")));
    }

    @Test
    @DisplayName("내보내기는 Markdown 파일로 항목마다 이름·값·메모·접수번호·위치·DART 주소를 적는다")
    void exportsMarkdownWithSources() throws Exception {
        String token = login("member@example.com");
        add(token, financialBody("환율 효과\n확인"));
        add(token, textBody(textChangeId("MODIFIED")));

        String markdown = mvc.perform(get("/api/notes/export").param("corpCode", CORP)
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "text/markdown;charset=UTF-8"))
                .andExpect(header().string("Content-Disposition",
                        "attachment; filename=\"judgment-note-" + CORP + ".md\""))
                .andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);

        assertThat(markdown).startsWith("# 예시전자 판단 노트\n")
                .contains("- 고유번호: " + CORP)
                .contains("## 1. II. 사업의 내용 > 1. 사업의 개요")
                .contains("- 종류: 문장 변경 · 수정")
                .contains("  > 당사는 메모리와 파운드리를 만듭니다.")
                .contains("접수번호 " + CUR + " · 섹션 2 · 문단 1 · 분석 " + analysisId)
                .contains("## 2. 손익계산서 · 매출액")
                .contains("- 담은 값: 이전 1,000,000원 → 현재 1,200,000원, 증감 +200,000원(+20.0%)")
                .contains("- 메모: 환율 효과 / 확인")
                .contains("접수번호 " + CUR + " · 재무제표 IS · 분석 " + analysisId)
                .contains("- DART 원문: https://dart.fss.or.kr/dsaf001/main.do?rcpNo=" + CUR)
                .doesNotContain("분석 방식이 바뀌어");
    }

    @Test
    @DisplayName("담은 것이 없으면 안내만 적고, 없는 기업은 COMPANY_NOT_FOUND다")
    void exportsEmptyNoteAndRejectsUnknownCompany() throws Exception {
        String token = login("member@example.com");
        mvc.perform(get("/api/notes/export").param("corpCode", "00000002").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("담은 항목이 없어요.")));
        mvc.perform(get("/api/notes/export").param("corpCode", "99999999").header("Authorization", bearer(token)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COMPANY_NOT_FOUND"));
    }

    @Test
    @DisplayName("AI 답의 인용을 담으면 저장된 질문·원문 문단으로 사본을 만들고 원문 확인 위치를 남긴다")
    void savesAnswerCitationFromStoredAnswer() throws Exception {
        document(CUR, "매출액은 메모리 수요 회복으로 늘었습니다.");
        document(PREV, "매출액은 줄었습니다.");
        long questionId = question("ANSWERED", CUR + "#B3," + PREV + "#B3");
        String token = login("member@example.com");
        // 화면이 글을 보내도 쓰지 않는다
        String body = citationBody(questionId, 2, "\"memo\":\"이전 설명과 비교\",\"text\":\"조작한 글\","
                + "\"label\":\"조작한 이름\"");
        mvc.perform(post("/api/notes").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.kind").value("ANSWER_CITATION"))
                .andExpect(jsonPath("$.corpCode").value(CORP))
                .andExpect(jsonPath("$.label").value("IV. 이사의 경영진단 및 분석의견 > 2. 영업실적"))
                .andExpect(jsonPath("$.text").value("매출액은 줄었습니다."))
                .andExpect(jsonPath("$.question").value("매출액은 왜 바뀌었나요?"))
                .andExpect(jsonPath("$.changeType").doesNotExist())
                .andExpect(jsonPath("$.memo").value("이전 설명과 비교"))
                .andExpect(jsonPath("$.source.analysisId").value(analysisId))
                .andExpect(jsonPath("$.source.changeId").doesNotExist())
                .andExpect(jsonPath("$.source.questionId").value(questionId))
                .andExpect(jsonPath("$.source.side").value("previous"))
                .andExpect(jsonPath("$.source.rceptNo").value(PREV))
                .andExpect(jsonPath("$.source.sectionNo").value(2))
                .andExpect(jsonPath("$.source.blockNo").value(3))
                .andExpect(jsonPath("$.source.dartUrl").value("https://dart.fss.or.kr/dsaf001/main.do?rcpNo=" + PREV))
                .andExpect(jsonPath("$.outdated").value(false));

        String other = login("other@example.com");
        mvc.perform(get("/api/notes").header("Authorization", bearer(other)))
                .andExpect(jsonPath("$.companies", hasSize(0)));
        String markdown = mvc.perform(get("/api/notes/export").param("corpCode", CORP)
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        assertThat(markdown).contains("- 종류: AI 답 인용")
                .contains("- 질문: 매출액은 왜 바뀌었나요?")
                .contains("  > 매출액은 줄었습니다.")
                .contains("접수번호 " + PREV + " · 섹션 2 · 문단 3 · 분석 " + analysisId);
    }

    @Test
    @DisplayName("없는 질문·인용이거나 답하지 않은 질문이면 404이고, 인용 번호가 없거나 잘못되면 400이다")
    void rejectsUnknownCitation() throws Exception {
        document(CUR, "매출액은 메모리 수요 회복으로 늘었습니다.");
        long answered = question("ANSWERED", CUR + "#B3");
        long notFound = question("NOT_FOUND", null);
        String token = login("member@example.com");
        for (String body : List.of(citationBody(answered, 2, null), citationBody(999_999L, 1, null),
                citationBody(notFound, 1, null))) {
            mvc.perform(post("/api/notes").header("Authorization", bearer(token))
                            .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("ANALYSIS_QUESTION_NOT_FOUND"));
        }
        mvc.perform(post("/api/notes").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kind\":\"ANSWER_CITATION\",\"analysisId\":" + analysisId + ",\"questionId\":"
                                + answered + "}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("citationNo"));
        mvc.perform(post("/api/notes").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(citationBody(answered, 0, null)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("citationNo"));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM judgment_note_item", Integer.class)).isZero();
    }

    private void document(String rceptNo, String explanation) {
        List<Section> sections = List.of(
                new Section(1, null, 1, "IV. 이사의 경영진단 및 분석의견", null, false,
                        List.of(new Block(1, "PARAGRAPH", "경영진단 개요입니다.", null))),
                new Section(2, 1, 2, "2. 영업실적", null, false, List.of(
                        new Block(2, "PARAGRAPH", "당사는 메모리를 만듭니다.", null),
                        new Block(3, "PARAGRAPH", explanation, null))));
        StructuredDocumentResponse response = new StructuredDocumentResponse(rceptNo, "dart-xml-1", "STRUCTURED",
                null, null, rceptNo + ".xml", "utf-8", "반기보고서", "예시전자", List.of(), List.of(),
                Map.of("cells", 0, "sourceCells", 0), sections);
        ReportDocument saved = documentRepository.save(ReportDocument.structured(rceptNo, response, 100, NOW, NOW));
        documentStore.replace(saved.getId(), sections);
    }

    /** 저장된 질문 한 건. evidenceIds는 인용 번호 순서의 근거 ID(쉼표로 이음) */
    private long question(String status, String evidenceIds) {
        jdbc.update("INSERT INTO analysis_question (analysis_id, question, status, answer, evidence_ids, model, "
                + "prompt_version, generated_at, created_at) VALUES (?, ?, ?, ?, ?, 'fake-model', 'answer-1', ?, ?)",
                analysisId, "매출액은 왜 바뀌었나요?", status, evidenceIds == null ? null : "매출 설명이에요[1].",
                evidenceIds, NOW, NOW);
        return jdbc.queryForObject("SELECT MAX(id) FROM analysis_question", Long.class);
    }

    private String citationBody(long questionId, int citationNo, String extra) {
        return "{\"kind\":\"ANSWER_CITATION\",\"analysisId\":" + analysisId + ",\"questionId\":" + questionId
                + ",\"citationNo\":" + citationNo + (extra == null ? "" : "," + extra) + "}";
    }

    private long add(String token, String body) throws Exception {
        String response = mvc.perform(post("/api/notes").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(response, "$.itemId")).longValue();
    }

    private String financialBody(String memo) {
        return "{\"kind\":\"FINANCIAL_CHANGE\",\"analysisId\":" + analysisId + ",\"changeId\":"
                + financialChangeId("매출액") + (memo == null ? "" : ",\"memo\":\"" + memo.replace("\n", "\\n") + "\"")
                + "}";
    }

    private String textBody(long changeId) {
        return "{\"kind\":\"TEXT_CHANGE\",\"analysisId\":" + analysisId + ",\"changeId\":" + changeId + "}";
    }

    private long financialChangeId(String accountName) {
        return jdbc.queryForObject("SELECT id FROM financial_change WHERE analysis_id = ? AND account_name = ?",
                Long.class, analysisId, accountName);
    }

    private long textChangeId(String changeType) {
        return jdbc.queryForObject("SELECT id FROM text_change WHERE analysis_id = ? AND change_type = ?",
                Long.class, analysisId, changeType);
    }

    private String login(String email) throws Exception {
        String body = "{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}";
        mvc.perform(post("/api/users").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated());
        String response = mvc.perform(post("/api/sessions").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(response, "$.accessToken");
    }

    private static String bearer(String token) {
        return "Bearer " + token;
    }
}
