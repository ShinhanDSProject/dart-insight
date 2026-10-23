package com.dartinsight.analysis;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.common.web.ApiPaths;
import com.dartinsight.document.DocumentSection;
import com.dartinsight.document.DocumentService;
import com.dartinsight.document.ReportDocument;
import com.dartinsight.report.Report;
import com.dartinsight.report.ReportService;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
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
@RequiredArgsConstructor
public class SourceController {

    private final AnalysisResultService resultService;
    private final ReportService reportService;
    private final DocumentService documentService;

    @GetMapping
    public DocumentOutlineResponse outline(@PathVariable Long analysisId, @PathVariable String side) {
        Analysis analysis = resultService.get(analysisId);
        Report report = report(analysis, side);
        Optional<ReportDocument> document = documentService.find(report.getRceptNo());
        // 분석이 끝난 뒤 원문을 다시 구조화했으면(파서 버전이 바뀜) 저장된 근거 위치와 블록 번호가 다를 수 있다
        boolean restructured = document.isPresent() && analysis.getCompletedAt() != null
                && document.get().getStructuredAt() != null
                && document.get().getStructuredAt().isAfter(analysis.getCompletedAt());
        List<DocumentSection> sections = document.map(documentService::sections).orElse(List.of());
        return DocumentOutlineResponse.of(side, report, document, sections, restructured);
    }

    @GetMapping(ApiPaths.DOCUMENT_SECTION)
    public DocumentSectionResponse section(@PathVariable Long analysisId, @PathVariable String side,
            @PathVariable int sectionNo) {
        Report report = report(resultService.get(analysisId), side);
        ReportDocument document = documentService.find(report.getRceptNo())
                .filter(d -> d.getStatus().usable())
                .orElseThrow(() -> new ApiException(ErrorCode.REPORT_SECTION_NOT_FOUND));
        List<DocumentSection> sections = documentService.sections(document);
        DocumentSection section = sections.stream().filter(s -> s.sectionNo() == sectionNo).findFirst()
                .orElseThrow(() -> new ApiException(ErrorCode.REPORT_SECTION_NOT_FOUND));
        return DocumentSectionResponse.of(side, report.getRceptNo(), section,
                TextEvidenceService.paths(sections).get(section.sectionNo()),
                documentService.sectionBlocks(document, sectionNo));
    }

    private Report report(Analysis analysis, String side) {
        String rceptNo = switch (side) {
            case "current" -> analysis.getCurrentRceptNo();
            case "previous" -> analysis.getPreviousRceptNo();
            default -> throw ApiException.invalidInput("side", "current 또는 previous여야 합니다.");
        };
        return reportService.get(rceptNo).report();
    }
}
