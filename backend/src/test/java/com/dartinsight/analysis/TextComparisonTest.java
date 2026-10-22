package com.dartinsight.analysis;

import static org.assertj.core.api.Assertions.assertThat;

import com.dartinsight.aiserver.FakeAiServer;
import com.dartinsight.aiserver.FakeAiServer.Reply;
import com.dartinsight.company.CompanyImportService;
import com.dartinsight.dart.CorpCodeEntry;
import com.dartinsight.dart.FakeOpenDartServer;
import com.dartinsight.dart.FakeOpenDartServer.Response;
import com.dartinsight.report.Correction;
import com.dartinsight.report.Report;
import com.dartinsight.report.ReportNameParser.ParsedReportName;
import com.dartinsight.report.ReportRepository;
import com.dartinsight.report.ReportType;
import com.dartinsight.support.TestData;
import com.dartinsight.support.TestDocuments;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/** 문장 비교(2.5): 원문 구조화 → AI 서버 비교 → 저장된 원문 글을 위치에 붙이기 */
@SpringBootTest
class TextComparisonTest {

    static final FakeOpenDartServer DART = startDart();
    static final FakeAiServer AI = new FakeAiServer();
    static final String PREV = "20250814000001";
    static final String CUR = "20260814000001";
    static final String DOC_PATH = "/api/document.xml";
    static final String DIFF = "/internal/text-changes";
    static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 21, 9, 0);

    @DynamicPropertySource
    static void servers(DynamicPropertyRegistry registry) {
        registry.add("app.opendart.base-url", DART::baseUrl);
        registry.add("app.opendart.read-timeout", () -> "2s");
        registry.add("app.ai-server.base-url", AI::baseUrl);
    }

    private static FakeOpenDartServer startDart() {
        try {
            return new FakeOpenDartServer();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    @Autowired
    private TextComparisonService service;

    @Autowired
    private ReportRepository reportRepository;

    @Autowired
    private CompanyImportService companyImportService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private Report previous;
    private Report current;

    @BeforeEach
    void setUp() {
        TestData.clearAll(jdbcTemplate);
        TestDocuments.clearCache();
        AI.clear();
        companyImportService.save(List.of(
                new CorpCodeEntry("00000001", "예시전자", null, "900001", LocalDate.of(2026, 1, 1))));
        previous = save(PREV, 2025);
        current = save(CUR, 2026);
        DART.on(DOC_PATH, Response.zip(TestDocuments.zip(PREV)));
        AI.on("/internal/documents/parser", Reply.ok("{\"parserVersion\":\"dart-xml-1\"}"));
        AI.on("/internal/documents/" + PREV + "/structure", Reply.ok(document(PREV, "STRUCTURED",
                "당사는 메모리를 만듭니다.", "구분 | 금액\\n매출 | 1,000")));
        AI.on("/internal/documents/" + CUR + "/structure", Reply.ok(document(CUR, "STRUCTURED",
                "당사는 메모리와 파운드리를 만듭니다.", "구분 | 금액\\n매출 | 1,200")));
        AI.on(DIFF, Reply.ok("""
                {"diffVersion":"text-diff-1","sectionCounts":{"matched":2},"changes":[
                 {"changeType":"MODIFIED","blockType":"PARAGRAPH","sectionStatus":"MATCHED",
                  "sectionTitle":"1. 사업의 개요","sectionPath":"II. 사업의 내용 > 1. 사업의 개요",
                  "previous":{"sectionNo":2,"blockNo":1},"current":{"sectionNo":2,"blockNo":1},
                  "numbersOnly":false,"similarity":0.71234,"reviewReason":null},
                 {"changeType":"MODIFIED","blockType":"TABLE","sectionStatus":"MATCHED",
                  "sectionTitle":"1. 사업의 개요","sectionPath":"II. 사업의 내용 > 1. 사업의 개요",
                  "previous":{"sectionNo":2,"blockNo":2},"current":{"sectionNo":2,"blockNo":2},
                  "numbersOnly":true,"similarity":0.95,"reviewReason":null},
                 {"changeType":"REVIEW_NEEDED","blockType":"SECTION","sectionStatus":"AMBIGUOUS",
                  "sectionTitle":"II. 사업의 내용","sectionPath":"II. 사업의 내용",
                  "previous":null,"current":{"sectionNo":1,"blockNo":null},
                  "numbersOnly":false,"similarity":null,"reviewReason":"짝을 정하지 못했어요."}
                ]}
                """));
    }

    private Report save(String rceptNo, int year) {
        return reportRepository.save(Report.create(rceptNo, "00000001", "반기보고서 (" + year + ".06)",
                new ParsedReportName(ReportType.HALF, year, LocalDate.of(year, 6, 30), Correction.ORIGINAL),
                LocalDate.of(year, 8, 14), null, "예시전자", NOW));
    }

    static String document(String rceptNo, String status, String paragraph, String table) {
        return """
                {"rceptNo":"%s","parserVersion":"dart-xml-1","status":"%s","mainFile":"%s.xml",
                 "warnings":%s,"counts":{"cells":4,"sourceCells":4},
                 "sections":[
                  {"sectionNo":1,"parentNo":null,"level":1,"title":"II. 사업의 내용","cover":false,"blocks":[]},
                  {"sectionNo":2,"parentNo":1,"level":2,"title":"1. 사업의 개요","cover":false,"blocks":[
                    {"blockNo":1,"type":"PARAGRAPH","text":"%s"},
                    {"blockNo":2,"type":"TABLE","text":"%s","rows":[[{"text":"구분"}]]}]}
                 ]}
                """.formatted(rceptNo, status, rceptNo,
                "PARTIAL".equals(status) ? "[{\"code\":\"CELL_COUNT_MISMATCH\",\"message\":\"셀 수 다름\"}]" : "[]",
                paragraph, table);
    }

    @Test
    void storedTextIsAttachedToTheReturnedPositions() {
        TextComparison result = service.compare(previous, current);

        assertThat(result.status()).isEqualTo(TextStatus.COMPLETED);
        assertThat(result.message()).isNull();
        assertThat(result.rows()).hasSize(3);
        TextChangeRow paragraph = result.rows().get(0);
        assertThat(paragraph.previous().rceptNo()).isEqualTo(PREV);
        assertThat(paragraph.previous().text()).isEqualTo("당사는 메모리를 만듭니다.");
        assertThat(paragraph.current().text()).isEqualTo("당사는 메모리와 파운드리를 만듭니다.");
        assertThat(paragraph.similarity()).isEqualByComparingTo("0.7123");
        assertThat(result.rows().get(1).numbersOnly()).isTrue();
        TextChangeRow review = result.rows().get(2);
        assertThat(review.previous()).isNull();
        assertThat(review.current().blockNo()).isNull();
        assertThat(review.current().sectionNo()).isEqualTo(1);
    }

    @Test
    void bothDocumentsAreSentWithSectionDepthAsLevel() {
        service.compare(previous, current);

        String body = AI.requests(DIFF).getFirst().bodyText();
        assertThat(body).contains("\"rceptNo\":\"" + PREV + "\"").contains("\"rceptNo\":\"" + CUR + "\"");
        assertThat(body).contains("\"level\":2").contains("당사는 메모리와 파운드리를 만듭니다.");
    }

    @Test
    void partlyReadDocumentMakesTheComparisonPartial() {
        AI.on("/internal/documents/" + CUR + "/structure", Reply.ok(document(CUR, "PARTIAL", "a", "b")));

        TextComparison result = service.compare(previous, current);

        assertThat(result.status()).isEqualTo(TextStatus.PARTIAL);
        assertThat(result.message()).contains("현재 보고서 원문 일부");
    }

    @Test
    void missingDocumentFailsOnlyTheTextComparison() {
        DART.on(DOC_PATH, Response.zip(TestDocuments.zip(PREV)),
                Response.xml("<result><status>014</status><message>파일이 존재하지 않습니다.</message></result>"));

        TextComparison result = service.compare(previous, current);

        assertThat(result.status()).isEqualTo(TextStatus.FAILED);
        assertThat(result.message()).contains("현재 보고서 원문이 OpenDART에 없어");
        assertThat(result.rows()).isEmpty();
        assertThat(AI.requests(DIFF)).isEmpty();
    }

    @Test
    void aiServerFailureDuringComparisonIsReportedNotThrown() {
        AI.on(DIFF, Reply.error(500, "COMMON_INTERNAL_ERROR", "오류"));

        TextComparison result = service.compare(previous, current);

        assertThat(result.status()).isEqualTo(TextStatus.FAILED);
        assertThat(result.message()).contains("AI 서버");
    }

    @Test
    void positionWithoutStoredBlockHasNoText() {
        AI.on(DIFF, Reply.ok("""
                {"changes":[{"changeType":"ADDED","blockType":"PARAGRAPH","sectionStatus":"MATCHED",
                  "sectionTitle":"t","sectionPath":"t","previous":null,"current":{"sectionNo":2,"blockNo":99}}]}
                """));

        TextComparison result = service.compare(previous, current);

        assertThat(result.rows().getFirst().current().text()).isNull();
    }
}
