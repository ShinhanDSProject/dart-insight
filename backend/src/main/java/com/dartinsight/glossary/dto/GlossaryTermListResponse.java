package com.dartinsight.glossary.dto;

import com.dartinsight.glossary.domain.GlossaryTerm;
import java.util.List;

/**
 * 공시 용어 카드 목록(docs/api-spec.md, ADR-0061). 카드가 없으면 items는 빈 목록.
 */
public record GlossaryTermListResponse(List<GlossaryTermResponse> items) {

    public static GlossaryTermListResponse from(List<GlossaryTerm> terms) {
        return new GlossaryTermListResponse(terms.stream().map(GlossaryTermResponse::from).toList());
    }
}
