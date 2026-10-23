package com.dartinsight.analysis;

import com.dartinsight.analysis.TextChangeRow.Side;
import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.document.DocumentBlock;
import com.dartinsight.document.DocumentSection;
import com.dartinsight.document.DocumentService;
import com.dartinsight.document.ReportDocument;
import com.dartinsight.report.DartLinks;
import com.dartinsight.report.Report;
import com.dartinsight.report.ReportService;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;

/**
 * 문장·표 근거 상세(3.4). 변경 전·후 원문을 보고서·항목·위치와 함께 돌려준다.
 * 글은 분석할 때 저장한 것을 쓴다. 표 셀은 저장된 원문 블록의 글이 같을 때만 붙인다
 * (원문을 다시 구조화해 위치가 달라졌으면 글만 보여 주고 표 셀은 붙이지 않음).
 */
@Service
public class TextEvidenceService {

    private final AnalysisResultService resultService;
    private final TextChangeStore store;
    private final ReportService reportService;
    private final DocumentService documentService;

    public TextEvidenceService(AnalysisResultService resultService, TextChangeStore store, ReportService reportService,
            DocumentService documentService) {
        this.resultService = resultService;
        this.store = store;
        this.reportService = reportService;
        this.documentService = documentService;
    }

    public TextEvidence evidence(Long analysisId, Long changeId) {
        resultService.completed(analysisId);
        TextChange change = store.find(analysisId, changeId)
                .orElseThrow(() -> new ApiException(ErrorCode.ANALYSIS_TEXT_CHANGE_NOT_FOUND));
        TextChangeRow row = change.row();
        return new TextEvidence(change, source(row.previous(), row.sectionPath()),
                source(row.current(), row.sectionPath()));
    }

    private SourceEvidence source(Side side, String fallbackPath) {
        if (side == null) {
            return null;
        }
        Report report = reportService.get(side.rceptNo()).report();
        Optional<ReportDocument> document = documentService.find(side.rceptNo()).filter(d -> d.getStatus().usable());
        String path = document.map(d -> paths(documentService.sections(d)).get(side.sectionNo())).orElse(null);
        String tableJson = null;
        String blockType = null;
        boolean matches = false;
        if (document.isPresent() && side.blockNo() != null) {
            Optional<DocumentBlock> block = documentService.block(document.get(), side.blockNo());
            if (block.isPresent() && block.get().text().equals(side.text())) {
                matches = true;
                tableJson = block.get().tableJson();
                blockType = block.get().type();
            }
        }
        return new SourceEvidence(report, side, path == null ? fallbackPath : path, blockType, tableJson, matches,
                DartLinks.viewer(report.getRceptNo()));
    }

    /** 섹션 번호 → 상위 섹션부터 이은 제목 */
    static Map<Integer, String> paths(List<DocumentSection> sections) {
        Map<Integer, DocumentSection> byNo = new HashMap<>();
        for (DocumentSection section : sections) {
            byNo.put(section.sectionNo(), section);
        }
        Map<Integer, String> paths = new HashMap<>();
        for (DocumentSection section : sections) {
            StringBuilder path = new StringBuilder(section.title());
            Integer parent = section.parentNo();
            int guard = 0;
            while (parent != null && byNo.containsKey(parent) && guard++ < 20) {
                DocumentSection up = byNo.get(parent);
                path.insert(0, up.title() + " > ");
                parent = up.parentNo();
            }
            paths.put(section.sectionNo(), path.toString());
        }
        return paths;
    }

    public record TextEvidence(TextChange change, SourceEvidence previous, SourceEvidence current) {
    }

    /**
     * 한쪽 보고서의 근거.
     *
     * @param tableJson   표 셀(JSON). 문단이거나 저장된 원문과 맞지 않으면 null
     * @param blockMatches 저장된 원문 블록의 글이 분석 때 글과 같은지
     */
    public record SourceEvidence(Report report, Side side, String sectionPath, String blockType, String tableJson,
            boolean blockMatches, String dartUrl) {
    }
}
