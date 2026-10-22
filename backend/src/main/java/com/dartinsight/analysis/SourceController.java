package com.dartinsight.analysis;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.common.web.ApiPaths;
import com.dartinsight.document.DocumentBlock;
import com.dartinsight.document.DocumentSection;
import com.dartinsight.document.DocumentService;
import com.dartinsight.document.ReportDocument;
import com.dartinsight.report.DartLinks;
import com.dartinsight.report.Report;
import com.dartinsight.report.ReportService;
import com.fasterxml.jackson.annotation.JsonRawValue;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 앱 안 원문 확인(3.5). 화면 W-03 ④. 분석의 두 보고서(현재·비교) 원문만 보여 준다(근거가 이 보고서 쌍의 것인지 확인).
 * 원문은 분석할 때 구조화(4.2)해 둔 목차·문단·표다. DART 원문 안의 위치로 바로 가는 주소는 만들지 않는다(위치 이동 미지원).
 */
@RestController
@RequestMapping(ApiPaths.ANALYSIS_DOCUMENT)
public class SourceController {

    private final AnalysisResultService resultService;
    private final ReportService reportService;
    private final DocumentService documentService;

    public SourceController(AnalysisResultService resultService, ReportService reportService,
            DocumentService documentService) {
        this.resultService = resultService;
        this.reportService = reportService;
        this.documentService = documentService;
    }

    @GetMapping
    public DocumentOutline outline(@PathVariable Long analysisId, @PathVariable String side) {
        Analysis analysis = resultService.get(analysisId);
        Report report = report(analysis, side);
        Optional<ReportDocument> document = documentService.find(report.getRceptNo());
        // 분석이 끝난 뒤 원문을 다시 구조화했으면(파서 버전이 바뀜) 저장된 근거 위치와 블록 번호가 다를 수 있다
        boolean restructured = document.isPresent() && analysis.getCompletedAt() != null
                && document.get().getStructuredAt() != null
                && document.get().getStructuredAt().isAfter(analysis.getCompletedAt());
        String status = document.map(d -> d.getStatus().name()).orElse(NOT_FETCHED);
        // 끝까지 읽은 원문은 안내할 것이 없다(null). Optional.map은 null을 빈 값으로 바꾸므로 나눠 쓴다
        String message = document.isPresent() ? document.get().statusMessage()
                : "이 보고서 원문은 아직 받지 않았어요. 분석을 다시 요청하면 받아 와요.";
        List<SectionItem> sections = document.map(documentService::sections).orElse(List.of()).stream()
                .map(s -> new SectionItem(s.sectionNo(), s.parentNo(), s.depth(), s.title(), s.cover(),
                        s.blockCount()))
                .toList();
        return new DocumentOutline(side, report.getRceptNo(), report.getReportName(), status, message,
                DartLinks.viewer(report.getRceptNo()), false, restructured, sections);
    }

    @GetMapping(ApiPaths.DOCUMENT_SECTION)
    public SectionContent section(@PathVariable Long analysisId, @PathVariable String side,
            @PathVariable int sectionNo) {
        Report report = report(resultService.get(analysisId), side);
        ReportDocument document = documentService.find(report.getRceptNo())
                .filter(d -> d.getStatus().usable())
                .orElseThrow(() -> new ApiException(ErrorCode.REPORT_SECTION_NOT_FOUND));
        List<DocumentSection> sections = documentService.sections(document);
        DocumentSection section = sections.stream().filter(s -> s.sectionNo() == sectionNo).findFirst()
                .orElseThrow(() -> new ApiException(ErrorCode.REPORT_SECTION_NOT_FOUND));
        Map<Integer, String> paths = TextEvidenceService.paths(sections);
        List<BlockItem> blocks = documentService.sectionBlocks(document, sectionNo).stream()
                .map(SourceController::block).toList();
        return new SectionContent(side, report.getRceptNo(), section.sectionNo(), section.title(),
                paths.get(section.sectionNo()), blocks);
    }

    private Report report(Analysis analysis, String side) {
        String rceptNo = switch (side) {
            case "current" -> analysis.getCurrentRceptNo();
            case "previous" -> analysis.getPreviousRceptNo();
            default -> throw ApiException.invalidInput("side", "current 또는 previous여야 합니다.");
        };
        return reportService.get(rceptNo).report();
    }

    private static BlockItem block(DocumentBlock block) {
        return new BlockItem(block.blockNo(), block.evidenceId(), block.type(), block.text(), block.tableJson());
    }

    static final String NOT_FETCHED = "NOT_FETCHED";

    /**
     * 원문 목차.
     *
     * @param documentStatus        STRUCTURED, PARTIAL, FAILED, NOT_AVAILABLE, 아직 받지 않았으면 NOT_FETCHED
     * @param positionLinkSupported DART 원문 안 위치로 바로 가는 주소를 주는지(지금은 늘 false)
     */
    /**
     * @param restructuredAfterAnalysis 분석이 끝난 뒤 원문을 다시 구조화해, 분석이 가리킨 근거 위치가 달라졌을 수 있음
     */
    public record DocumentOutline(String side, String rceptNo, String reportName, String documentStatus,
            String statusMessage, String dartUrl, boolean positionLinkSupported, boolean restructuredAfterAnalysis,
            List<SectionItem> sections) {
    }

    public record SectionItem(int sectionNo, Integer parentNo, int depth, String title, boolean cover,
            int blockCount) {
    }

    public record SectionContent(String side, String rceptNo, int sectionNo, String title, String sectionPath,
            List<BlockItem> blocks) {
    }

    /** table은 표 셀(JSON 그대로), 문단이면 null */
    public record BlockItem(int blockNo, String evidenceId, String type, String text, @JsonRawValue String table) {
    }
}
