package com.dartinsight.keyfact.controller;

import com.dartinsight.common.web.ApiPaths;
import com.dartinsight.keyfact.dto.KeyFactsResponse;
import com.dartinsight.keyfact.service.KeyFactService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 최대주주·임원·배당 변화 API(docs/api-spec.md, #331). 기업 화면 '기업 개요' 탭. */
@RestController
@RequestMapping(ApiPaths.COMPANY_KEY_FACTS)
@RequiredArgsConstructor
public class KeyFactController {

    private final KeyFactService keyFactService;

    @GetMapping
    public KeyFactsResponse find(@PathVariable String corpCode) {
        return KeyFactsResponse.from(keyFactService.keyFacts(corpCode));
    }
}
