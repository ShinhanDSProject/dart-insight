package com.dartinsight.analysis.dto;

import com.dartinsight.document.domain.DocumentSection;
import com.dartinsight.document.domain.ReportDocument;
import com.dartinsight.report.domain.DartLinks;
import com.dartinsight.report.domain.Report;
import java.util.List;
import java.util.Optional;

/**
 * 원문 목차.
 *
 * @param documentStatus            STRUCTURED, PARTIAL, FAILED, NOT_AVAILABLE, 아직 받지 않았으면 NOT_FETCHED
 * @param positionLinkSupported     DART 원문 안 위치로 바로 가는 주소를 주는지(지금은 늘 false)
 * @param restructuredAfterAnalysis 분석이 끝난 뒤 원문을 다시 구조화해, 분석이 가리킨 근거 위치가 달라졌을 수 있음
 */
public record DocumentOutlineResponse(String side, String rceptNo, String reportName, String documentStatus,
        String statusMessage, String dartUrl, boolean positionLinkSupported, boolean restructuredAfterAnalysis,
        List<SectionItem> sections) {

    static final String NOT_FETCHED = "NOT_FETCHED";

    /** @param document 받은 원문. 아직 받지 않았으면 빈 값 */
    public static DocumentOutlineResponse of(String side, Report report, Optional<ReportDocument> document,
            List<DocumentSection> sections, boolean restructured) {
        String status = document.map(d -> d.getStatus().name()).orElse(NOT_FETCHED);
        // 끝까지 읽은 원문은 안내할 것이 없다(null). Optional.map은 null을 빈 값으로 바꾸므로 나눠 쓴다
        String message = document.isPresent() ? document.get().statusMessage()
                : "이 보고서 원문은 아직 받지 않았어요. 분석을 다시 요청하면 받아 와요.";
        return new DocumentOutlineResponse(side, report.getRceptNo(), report.getReportName(), status, message,
                DartLinks.viewer(report.getRceptNo()), false, restructured,
                sections.stream().map(SectionItem::from).toList());
    }

    public record SectionItem(int sectionNo, Integer parentNo, int depth, String title, boolean cover,
            int blockCount) {

        static SectionItem from(DocumentSection s) {
            return new SectionItem(s.sectionNo(), s.parentNo(), s.depth(), s.title(), s.cover(), s.blockCount());
        }
    }
}
