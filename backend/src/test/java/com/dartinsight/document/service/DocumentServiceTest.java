package com.dartinsight.document.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.dartinsight.aiserver.client.AiServerException;
import com.dartinsight.aiserver.client.FakeAiServer;
import com.dartinsight.aiserver.client.FakeAiServer.Reply;
import com.dartinsight.company.service.CompanyImportService;
import com.dartinsight.dart.domain.CorpCodeEntry;
import com.dartinsight.dart.client.FakeOpenDartServer;
import com.dartinsight.dart.client.FakeOpenDartServer.Response;
import com.dartinsight.document.domain.DocumentBlock;
import com.dartinsight.document.domain.DocumentSection;
import com.dartinsight.document.domain.DocumentStatus;
import com.dartinsight.document.domain.ReportDocument;
import com.dartinsight.report.domain.Correction;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.domain.ReportNameParser.ParsedReportName;
import com.dartinsight.report.repository.ReportRepository;
import com.dartinsight.report.domain.ReportType;
import com.dartinsight.support.TestData;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

@SpringBootTest
class DocumentServiceTest {

    static final FakeOpenDartServer DART = startDart();
    static final FakeAiServer AI = new FakeAiServer();
    static final String RCEPT = "20260814000001";
    static final String DOC_PATH = "/api/document.xml";
    static final String STRUCTURE = "/internal/documents/" + RCEPT + "/structure";
    static final String PARSER = "/internal/documents/parser";
    static final Path CACHE = Path.of("build/test-document-cache");
    static final byte[] ZIP = zip();

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
    private DocumentService service;

    @Autowired
    private ReportRepository reportRepository;

    @Autowired
    private CompanyImportService companyImportService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private Report report;

    @BeforeEach
    void setUp() throws IOException {
        TestData.clearAll(jdbcTemplate);
        clearCache();
        AI.clear();
        companyImportService.save(List.of(
                new CorpCodeEntry("00000001", "예시전자", null, "900001", LocalDate.of(2026, 1, 1))));
        report = reportRepository.save(Report.create(RCEPT, "00000001", "반기보고서 (2026.06)",
                new ParsedReportName(ReportType.HALF, 2026, LocalDate.of(2026, 6, 30), Correction.ORIGINAL),
                LocalDate.of(2026, 8, 14), null, "예시전자", LocalDateTime.of(2026, 10, 21, 9, 0)));
        AI.on(PARSER, Reply.ok("{\"parserVersion\":\"dart-xml-1\"}"));
        AI.on(STRUCTURE, Reply.ok(structured("STRUCTURED", "dart-xml-1")));
        DART.on(DOC_PATH, Response.zip(ZIP));
    }

    static void clearCache() throws IOException {
        if (Files.exists(CACHE)) {
            try (Stream<Path> files = Files.walk(CACHE)) {
                files.sorted(Comparator.reverseOrder()).forEach(p -> p.toFile().delete());
            }
        }
    }

    static byte[] zip() {
        try (ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                ZipOutputStream out = new ZipOutputStream(bytes)) {
            out.putNextEntry(new ZipEntry(RCEPT + ".xml"));
            out.write("<DOCUMENT/>".getBytes(StandardCharsets.UTF_8));
            out.closeEntry();
            out.finish();
            return bytes.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    static String structured(String status, String version) {
        return """
                {"rceptNo":"%s","parserVersion":"%s","status":"%s","failureCode":null,"failureMessage":null,
                 "mainFile":"%s.xml","encoding":"utf-8","attachments":["%s_00760.xml"],
                 "warnings":%s,
                 "counts":{"cells":3,"sourceCells":%d},
                 "sections":[
                  {"sectionNo":1,"parentNo":null,"level":1,"title":"I. 회사의 개요","ref":"D-0-1-0-0","cover":false,
                   "blocks":[{"blockNo":1,"type":"PARAGRAPH","text":"당사는 \\"예시\\"입니다."}]},
                  {"sectionNo":2,"parentNo":1,"level":2,"title":"1. 개요","ref":null,"cover":false,
                   "blocks":[{"blockNo":2,"type":"TABLE","text":"구분 | 금액\\n매출 | 1,000",
                              "rows":[[{"text":"구분","header":true},{"text":"금액","header":true}],
                                      [{"text":"매출"},{"text":"1,000"}]],"unknown":1}]}
                 ]}
                """.formatted(RCEPT, version, status, RCEPT, RCEPT,
                status.equals("PARTIAL") ? "[{\"code\":\"CELL_COUNT_MISMATCH\",\"message\":\"셀 수 다름\"}]" : "[]",
                status.equals("PARTIAL") ? 4 : 3);
    }

    private long dartCalls() {
        return DART.requests().stream().filter(r -> r.startsWith(DOC_PATH)).count();
    }

    @Test
    void downloadsStructuresAndStoresSectionsAndBlocksOnce() {
        long before = dartCalls();

        ReportDocument document = service.ensureStructured(report);

        assertThat(document.getStatus()).isEqualTo(DocumentStatus.STRUCTURED);
        assertThat(document.getParserVersion()).isEqualTo("dart-xml-1");
        assertThat(document.getSectionCount()).isEqualTo(2);
        assertThat(document.getBlockCount()).isEqualTo(2);
        assertThat(document.getMainFile()).isEqualTo(RCEPT + ".xml");
        assertThat(dartCalls()).isEqualTo(before + 1);
        assertThat(Files.exists(CACHE.resolve(RCEPT + ".zip"))).isTrue();
        assertThat(AI.requests(STRUCTURE)).singleElement()
                .satisfies(r -> assertThat(r.body()).isEqualTo(ZIP));

        List<DocumentSection> sections = service.sections(document);
        assertThat(sections).extracting(DocumentSection::title).containsExactly("I. 회사의 개요", "1. 개요");
        assertThat(sections.get(1).parentNo()).isEqualTo(1);
        assertThat(sections.get(0).sourceRef()).isEqualTo("D-0-1-0-0");
        List<DocumentBlock> blocks = service.blocks(document);
        assertThat(blocks).extracting(DocumentBlock::evidenceId).containsExactly(RCEPT + "#B1", RCEPT + "#B2");
        assertThat(blocks.get(0).text()).isEqualTo("당사는 \"예시\"입니다.");
        assertThat(blocks.get(0).tableJson()).isNull();
        assertThat(blocks.get(1).tableJson()).isEqualTo("[[{\"text\":\"구분\",\"header\":true},"
                + "{\"text\":\"금액\",\"header\":true}],[{\"text\":\"매출\"},{\"text\":\"1,000\"}]]");
        assertThat(service.sectionBlocks(document, 2)).extracting(DocumentBlock::blockNo).containsExactly(2);
        assertThat(service.block(document, 2)).get().extracting(DocumentBlock::sectionNo).isEqualTo(2);

        ReportDocument again = service.ensureStructured(report);

        assertThat(again.getId()).isEqualTo(document.getId());
        assertThat(dartCalls()).isEqualTo(before + 1);
        assertThat(AI.requests(STRUCTURE)).hasSize(1);
    }

    @Test
    void newParserVersionRestructuresFromTheCachedFileWithoutOpenDart() {
        service.ensureStructured(report);
        long before = dartCalls();
        AI.on(PARSER, Reply.ok("{\"parserVersion\":\"dart-xml-2\"}"));
        AI.on(STRUCTURE, Reply.ok(structured("STRUCTURED", "dart-xml-2")));

        ReportDocument document = service.ensureStructured(report);

        assertThat(document.getParserVersion()).isEqualTo("dart-xml-2");
        assertThat(dartCalls()).isEqualTo(before);
        assertThat(AI.requests(STRUCTURE)).hasSize(2);
        assertThat(service.blocks(document)).hasSize(2);
    }

    @Test
    void missingFileIsRememberedUntilTheReportIsSeenAgain() {
        DART.on(DOC_PATH, Response.xml("<result><status>014</status><message>파일이 존재하지 않습니다</message></result>"));
        long before = dartCalls();

        ReportDocument document = service.ensureStructured(report);

        assertThat(document.getStatus()).isEqualTo(DocumentStatus.NOT_AVAILABLE);
        assertThat(document.getFailureCode()).isEqualTo("DART_014");
        assertThat(service.blocks(document)).isEmpty();
        service.ensureStructured(report);
        assertThat(dartCalls()).isEqualTo(before + 1);
        assertThat(AI.requests(STRUCTURE)).isEmpty();

        report.refresh(report.getReportName(), new ParsedReportName(ReportType.HALF, 2026, LocalDate.of(2026, 6, 30),
                Correction.ORIGINAL), report.getRceptDt(), null, "예시전자", LocalDateTime.now().plusDays(1));
        report = reportRepository.save(report);
        DART.on(DOC_PATH, Response.zip(ZIP));

        ReportDocument refetched = service.ensureStructured(report);

        assertThat(refetched.getId()).isEqualTo(document.getId());
        assertThat(refetched.getStatus()).isEqualTo(DocumentStatus.STRUCTURED);
        assertThat(dartCalls()).isEqualTo(before + 2);
    }

    @Test
    void unreadableDocumentIsStoredAsFailedWithItsReason() {
        AI.on(STRUCTURE, Reply.ok("""
                {"rceptNo":"%s","parserVersion":"dart-xml-1","status":"FAILED","failureCode":"UNSUPPORTED_FORMAT",
                 "failureMessage":"원문에서 목차를 찾지 못했어요.","warnings":[],"counts":{},"sections":[]}
                """.formatted(RCEPT)));

        ReportDocument document = service.ensureStructured(report);

        assertThat(document.getStatus()).isEqualTo(DocumentStatus.FAILED);
        assertThat(document.getFailureCode()).isEqualTo("UNSUPPORTED_FORMAT");
        assertThat(document.getFailureMessage()).isEqualTo("원문에서 목차를 찾지 못했어요.");
        assertThat(service.sections(document)).isEmpty();
        service.ensureStructured(report);
        assertThat(AI.requests(STRUCTURE)).as("같은 파서로 다시 읽지 않음").hasSize(1);
    }

    @Test
    void partialResultKeepsItsWarnings() {
        AI.on(STRUCTURE, Reply.ok(structured("PARTIAL", "dart-xml-1")));

        ReportDocument document = service.ensureStructured(report);

        assertThat(document.getStatus()).isEqualTo(DocumentStatus.PARTIAL);
        assertThat(document.getWarnings()).isEqualTo("CELL_COUNT_MISMATCH: 셀 수 다름");
        assertThat(document.getSourceCellCount()).isEqualTo(4);
        assertThat(service.blocks(document)).hasSize(2);
    }

    @Test
    void aiServerFailureIsNotStored() {
        AI.on(STRUCTURE, Reply.error(500, "COMMON_INTERNAL_ERROR", "오류"));

        assertThatThrownBy(() -> service.ensureStructured(report)).isInstanceOf(AiServerException.class);

        assertThat(service.find(RCEPT)).isEmpty();
        assertThat(Files.exists(CACHE.resolve(RCEPT + ".zip"))).as("받은 원문은 캐시에 남음").isTrue();
    }
}
