package com.dartinsight.disclosure.controller;

import com.dartinsight.common.web.ApiPaths;
import com.dartinsight.disclosure.dto.DisclosureSignalsResponse;
import com.dartinsight.disclosure.service.DisclosureSignalService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 확인해 볼 공시 API(docs/api-spec.md, #411, FS-55). 화면: 기업 화면 '기업 개요' 탭.
 */
@RestController
@RequestMapping(ApiPaths.COMPANY_DISCLOSURE_SIGNALS)
@RequiredArgsConstructor
public class DisclosureSignalController {

    private final DisclosureSignalService disclosureSignalService;

    @GetMapping
    public DisclosureSignalsResponse signals(@PathVariable String corpCode) {
        return DisclosureSignalsResponse.from(disclosureSignalService.signals(corpCode));
    }
}
