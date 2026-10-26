package com.dartinsight.disclosure.controller;

import com.dartinsight.common.web.ApiPaths;
import com.dartinsight.disclosure.domain.DisclosureGroup;
import com.dartinsight.disclosure.dto.CompanyDisclosureListResponse;
import com.dartinsight.disclosure.dto.DisclosureKeyItemsResponse;
import com.dartinsight.disclosure.service.DisclosureKeyItemService;
import com.dartinsight.disclosure.service.DisclosureService;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 기업의 최근 공시 타임라인 API(docs/api-spec.md, #332). 화면: 기업 화면 '기업 개요' 탭.
 */
@RestController
@RequestMapping(ApiPaths.COMPANY_DISCLOSURES)
@RequiredArgsConstructor
public class CompanyDisclosureController {

    private final DisclosureService disclosureService;
    private final DisclosureKeyItemService keyItemService;

    @GetMapping
    public CompanyDisclosureListResponse list(@PathVariable String corpCode,
            @RequestParam(defaultValue = "90") @Min(value = 1, message = "1 이상이어야 합니다.")
            @Max(value = 365, message = "365 이하여야 합니다.") int days,
            @RequestParam(required = false) DisclosureGroup group) {
        return CompanyDisclosureListResponse.from(disclosureService.timeline(corpCode, days, group));
    }

    /** 주요사항보고서 한 건의 핵심 수치(FS-51, #363) */
    @GetMapping(ApiPaths.DISCLOSURE_KEY_ITEMS)
    public DisclosureKeyItemsResponse keyItems(@PathVariable String corpCode, @PathVariable String rceptNo) {
        return DisclosureKeyItemsResponse.from(keyItemService.get(corpCode, rceptNo));
    }
}
