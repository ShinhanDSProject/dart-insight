package com.dartinsight.relateddisclosure.controller;

import com.dartinsight.common.web.ApiPaths;
import com.dartinsight.relateddisclosure.dto.RelatedDisclosuresResponse;
import com.dartinsight.relateddisclosure.service.RelatedDisclosureService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 문장 변경의 관련 수시공시(보조 근거, 3.6, #343). 화면 W-03 ③. 처음 요청이면 분석 전체를 계산해 저장한다(ADR-0030). */
@RestController
@RequestMapping(ApiPaths.TEXT_CHANGE_RELATED_DISCLOSURES)
@RequiredArgsConstructor
public class RelatedDisclosureController {

    private final RelatedDisclosureService relatedDisclosureService;

    @GetMapping
    public RelatedDisclosuresResponse get(@PathVariable Long analysisId, @PathVariable Long changeId) {
        return RelatedDisclosuresResponse.from(relatedDisclosureService.forChange(analysisId, changeId));
    }
}
