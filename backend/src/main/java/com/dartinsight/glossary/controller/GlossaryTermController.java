package com.dartinsight.glossary.controller;

import com.dartinsight.common.web.ApiPaths;
import com.dartinsight.glossary.dto.GlossaryTermListResponse;
import com.dartinsight.glossary.service.GlossaryTermService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 공시 용어 카드 API(docs/api-spec.md, ADR-0061). 결과 화면 용어 풀이(FS-36)와 채팅이 쓴다. 로그인 없이 쓴다.
 */
@RestController
@RequestMapping(ApiPaths.GLOSSARY_TERMS)
@RequiredArgsConstructor
public class GlossaryTermController {

    private final GlossaryTermService glossaryTermService;

    @GetMapping
    public GlossaryTermListResponse list() {
        return glossaryTermService.list();
    }
}
