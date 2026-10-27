package com.dartinsight.relateddisclosure.service;

import static com.dartinsight.dart.client.DisclosureListJson.item;
import static com.dartinsight.dart.client.DisclosureListJson.page;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;

import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.domain.AnalysisStatus;
import com.dartinsight.analysis.domain.TextChangeRow;
import com.dartinsight.analysis.domain.TextChangeRow.Side;
import com.dartinsight.analysis.domain.TextComparison;
import com.dartinsight.analysis.domain.TextStatus;
import com.dartinsight.analysis.repository.AnalysisRepository;
import com.dartinsight.analysis.service.AnalysisResultService;
import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.company.service.CompanyImportService;
import com.dartinsight.comparison.domain.ComparisonBasis;
import com.dartinsight.dart.client.DisclosureListJson;
import com.dartinsight.dart.client.FakeOpenDartServer;
import com.dartinsight.dart.client.FakeOpenDartServer.Response;
import com.dartinsight.dart.domain.CorpCodeEntry;
import com.dartinsight.financial.domain.FsDiv;
import com.dartinsight.relateddisclosure.domain.DisclosureTiming;
import com.dartinsight.relateddisclosure.domain.MatchLevel;
import com.dartinsight.relateddisclosure.domain.RelatedDisclosureRules;
import com.dartinsight.relateddisclosure.domain.RelatedDisclosures;
import com.dartinsight.relateddisclosure.domain.RelatedLink;
import com.dartinsight.report.domain.Correction;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.domain.ReportNameParser.ParsedReportName;
import com.dartinsight.report.domain.ReportType;
import com.dartinsight.report.repository.ReportRepository;
import com.dartinsight.support.TestData;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

@SpringBootTest
class RelatedDisclosureServiceTest {

    private static final FakeOpenDartServer SERVER = startServer();
    private static final String LIST = "/api/list.json";
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
    private RelatedDisclosureService service;

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
        analysisId = save(analysis());
        // change_no 1: 소송 문단 추가, 2: 공급 계약 문단 삭제, 3: 어느 규칙에도 안 걸림
        List<TextChangeRow> rows = List.of(
                new TextChangeRow(TextChangeRow.ADDED, "PARAGRAPH", false, "MATCHED", "2. 우발부채 등",
                        "XI. 그 밖에 투자자 보호를 위하여 필요한 사항 > 2. 우발부채 등", null,
                        new Side(CUR, 5, 1, "회사는 손해배상 청구 소송을 제기받았습니다."), null, null),
                new TextChangeRow(TextChangeRow.DELETED, "PARAGRAPH", false, "MATCHED", "6. 주요계약",
                        "II. 사업의 내용 > 6. 주요계약 및 연구개발활동", new Side(PREV, 2, 4, "공급 계약을 맺었습니다."), null,
                        null, null),
                new TextChangeRow(TextChangeRow.MODIFIED, "PARAGRAPH", false, "MATCHED", "1. 요약재무정보",
                        "III. 재무에 관한 사항 > 1. 요약재무정보", new Side(PREV, 3, 1, "매출이 줄었습니다."),
                        new Side(CUR, 3, 1, "매출이 늘었습니다."), new BigDecimal("0.8"), null));
        resultService.saveAndComplete(analysisId, List.of(), new TextComparison(TextStatus.COMPLETED, null, rows));
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

    private int requestCount() {
        return SERVER.requests().size();
    }

    private int count(String table) {
        Integer n = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM " + table, Integer.class);
        return n == null ? 0 : n;
    }

    @Test
    @DisplayName("분석 기간의 공시 목록을 받아 모든 변경을 규칙으로 연결해 저장하고, 다음 요청은 저장된 결과를 준다")
    void computesSavesAndReusesLinks() {
        SERVER.on(LIST,
                Response.json(page(1, 1,
                        item("20260108000598", "주요사항보고서(소송등의제기)", "20260108", ""),
                        item("20260715000001", "주요사항보고서(소송등의제기)", "20260715", "철"))),
                Response.json(page(1, 1,
                        item("20250731800028", "단일판매ㆍ공급계약체결", "20250731", "유"),
                        item("20260701800001", "단일판매ㆍ공급계약체결", "20260701", "유"))),
                Response.json(DisclosureListJson.NO_DATA));
        int before = requestCount();

        RelatedDisclosures result = service.get(analysisId);

        assertThat(SERVER.requests().subList(before, requestCount())).hasSize(3)
                .allSatisfy(r -> assertThat(r).contains("bgn_de=20250630", "end_de=20260814", "last_reprt_at=N"));
        assertThat(result.cached()).isFalse();
        assertThat(result.run().ruleVersion()).isEqualTo(RelatedDisclosureRules.RULE_VERSION);
        assertThat(result.run().periodEnd()).isEqualTo(LocalDate.of(2026, 6, 30));
        assertThat(result.run().linkCount()).isEqualTo(3);
        assertThat(result.links()).extracting(RelatedLink::changeNo, l -> l.disclosure().rceptNo(),
                RelatedLink::matchRule, RelatedLink::timing).containsExactly(
                        tuple(1, "20260108000598", "litigation", DisclosureTiming.DURING),
                        tuple(2, "20250731800028", "supply-contract", DisclosureTiming.DURING),
                        tuple(2, "20260701800001", "supply-contract", DisclosureTiming.AFTER));
        assertThat(count("related_disclosure_run")).isEqualTo(1);
        assertThat(count("related_disclosure")).isEqualTo(3);

        int afterFirst = requestCount();
        RelatedDisclosures again = service.get(analysisId);

        assertThat(requestCount()).isEqualTo(afterFirst);
        assertThat(again.cached()).isTrue();
        assertThat(again.run().id()).isEqualTo(result.run().id());
        assertThat(again.links()).isEqualTo(result.links());
        assertThat(again.links()).allSatisfy(l -> {
            assertThat(l.matchLevel()).isEqualTo(MatchLevel.TYPE_ONLY);
            assertThat(l.latestRceptNo()).isNull();
            assertThat(l.matchedFields()).isNull();
        });
    }

    @Test
    @DisplayName("연결이 0건이어도 계산 기록을 저장하고 다음 요청은 다시 계산하지 않는다")
    void zeroLinksAreSavedAndNotRecomputed() {
        SERVER.on(LIST, Response.json(DisclosureListJson.NO_DATA));

        RelatedDisclosures result = service.get(analysisId);
        int before = requestCount();
        RelatedDisclosures again = service.get(analysisId);

        assertThat(result.links()).isEmpty();
        assertThat(result.run().linkCount()).isZero();
        assertThat(again.cached()).isTrue();
        assertThat(requestCount()).isEqualTo(before);
        assertThat(count("related_disclosure_run")).isEqualTo(1);
    }

    @Test
    @DisplayName("공시 목록을 받지 못하면 저장하지 않고 실패하며, 분석 상태와 분석 버전은 그대로다")
    void listFailureSavesNothingAndKeepsAnalysis() {
        SERVER.on(LIST, Response.json(DisclosureListJson.RATE_LIMITED));

        assertThatThrownBy(() -> service.get(analysisId))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).errorCode())
                .isEqualTo(ErrorCode.DART_RATE_LIMITED);

        assertThat(count("related_disclosure_run")).isZero();
        Analysis analysis = resultService.get(analysisId);
        assertThat(analysis.getStatus()).isEqualTo(AnalysisStatus.COMPLETED);
        assertThat(analysis.getAnalysisVersion()).isEqualTo(Analysis.CURRENT_VERSION);
    }

    @Test
    @DisplayName("계산해도 분석 상태와 분석 버전은 바뀌지 않는다")
    void computingDoesNotTouchAnalysis() {
        SERVER.on(LIST, Response.json(DisclosureListJson.NO_DATA));
        Analysis before = resultService.get(analysisId);

        service.get(analysisId);

        Analysis after = resultService.get(analysisId);
        assertThat(after.getStatus()).isEqualTo(AnalysisStatus.COMPLETED);
        assertThat(after.getAnalysisVersion()).isEqualTo(before.getAnalysisVersion());
        assertThat(after.getUpdatedAt()).isEqualTo(before.getUpdatedAt());
    }

    @Test
    @DisplayName("완료되지 않은 분석이면 409 ANALYSIS_NOT_READY이고 OpenDART를 부르지 않는다")
    void notCompletedAnalysisIsRejected() {
        Long running = save(analysis());
        int before = requestCount();

        assertThatThrownBy(() -> service.get(running))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).errorCode())
                .isEqualTo(ErrorCode.ANALYSIS_NOT_READY);
        assertThat(requestCount()).isEqualTo(before);
    }
}
