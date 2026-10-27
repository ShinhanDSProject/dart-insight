package com.dartinsight.analysis.service;

import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.document.domain.DocumentBlock;
import com.dartinsight.document.domain.DocumentSection;
import com.dartinsight.document.domain.ReportDocument;
import com.dartinsight.document.service.DocumentService;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.service.ReportService;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 앱 안 원문 확인(3.5). 분석의 두 보고서(현재·비교) 원문만 돌려준다(근거가 이 보고서 쌍의 것인지 확인).
 * 원문은 분석할 때 구조화(4.2)해 둔 목차·문단·표다.
 */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class SourceDocumentService {

    private final AnalysisResultService resultService;
    private final ReportService reportService;
    private final DocumentService documentService;

    /** 한쪽 보고서의 원문 목차. 원문을 아직 받지 않았으면 빈 목차 */
    public SourceOutline outline(Long analysisId, String side) {
        Analysis analysis = resultService.get(analysisId);
        Report report = report(analysis, side);
        Optional<ReportDocument> document = documentService.find(report.getRceptNo());
        // 분석이 끝난 뒤 원문을 다시 구조화했으면(파서 버전이 바뀜) 저장된 근거 위치와 블록 번호가 다를 수 있다
        boolean restructured = document.filter(d -> d.restructuredAfter(analysis.getCompletedAt())).isPresent();
        List<DocumentSection> sections = document.map(documentService::sections).orElse(List.of());
        return new SourceOutline(report, document, sections, restructured);
    }

    /** 한쪽 보고서 원문의 목차 한 항목과 그 문단·표. 읽을 수 있는 원문이나 그 항목이 없으면 404 */
    public SourceSection section(Long analysisId, String side, int sectionNo) {
        Report report = report(resultService.get(analysisId), side);
        ReportDocument document = documentService.find(report.getRceptNo())
                .filter(d -> d.getStatus().usable())
                .orElseThrow(() -> new ApiException(ErrorCode.REPORT_SECTION_NOT_FOUND));
        List<DocumentSection> sections = documentService.sections(document);
        DocumentSection section = sections.stream().filter(s -> s.sectionNo() == sectionNo).findFirst()
                .orElseThrow(() -> new ApiException(ErrorCode.REPORT_SECTION_NOT_FOUND));
        return new SourceSection(report, section, TextEvidenceService.paths(sections).get(section.sectionNo()),
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

    /**
     * @param document     받은 원문. 아직 받지 않았으면 빈 값
     * @param restructured 분석이 끝난 뒤 원문을 다시 구조화했는지
     */
    public record SourceOutline(Report report, Optional<ReportDocument> document, List<DocumentSection> sections,
            boolean restructured) {
    }

    /** @param sectionPath 상위 섹션부터 이은 제목 */
    public record SourceSection(Report report, DocumentSection section, String sectionPath,
            List<DocumentBlock> blocks) {
    }
}
