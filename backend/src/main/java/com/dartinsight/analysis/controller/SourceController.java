package com.dartinsight.analysis.controller;

import com.dartinsight.analysis.dto.DocumentOutlineResponse;
import com.dartinsight.analysis.dto.DocumentSectionResponse;
import com.dartinsight.analysis.service.SourceDocumentService.SourceOutline;
import com.dartinsight.analysis.service.SourceDocumentService.SourceSection;
import com.dartinsight.analysis.service.SourceDocumentService;
import com.dartinsight.common.web.ApiPaths;
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

    private final SourceDocumentService sourceService;

    @GetMapping
    public DocumentOutlineResponse outline(@PathVariable Long analysisId, @PathVariable String side) {
        SourceOutline outline = sourceService.outline(analysisId, side);
        return DocumentOutlineResponse.of(side, outline.report(), outline.document(), outline.sections(),
                outline.restructured());
    }

    @GetMapping(ApiPaths.DOCUMENT_SECTION)
    public DocumentSectionResponse section(@PathVariable Long analysisId, @PathVariable String side,
            @PathVariable int sectionNo) {
        SourceSection section = sourceService.section(analysisId, side, sectionNo);
        return DocumentSectionResponse.of(side, section.report().getRceptNo(), section.section(),
                section.sectionPath(), section.blocks());
    }
}
