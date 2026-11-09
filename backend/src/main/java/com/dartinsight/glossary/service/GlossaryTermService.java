package com.dartinsight.glossary.service;

import com.dartinsight.glossary.domain.GlossaryTerm;
import com.dartinsight.glossary.dto.GlossaryTermListResponse;
import com.dartinsight.glossary.repository.GlossaryTermFile;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 공시 용어 카드(ADR-0061). 화면과 채팅이 같은 카드를 쓰고, 출처·검토일이 있는 카드만 내보낸다. LLM을 쓰지 않는다.
 */
@Service
@RequiredArgsConstructor
public class GlossaryTermService {

    private final GlossaryTermFile glossaryTermFile;

    /** 내보낼 수 있는 카드 목록(GET /api/glossary-terms). */
    public GlossaryTermListResponse list() {
        return GlossaryTermListResponse.from(published());
    }

    /** 내보낼 수 있는 카드. 채팅 Tool(lookup_terms, #769)도 이 카드만 쓴다. */
    public List<GlossaryTerm> published() {
        return glossaryTermFile.terms().published();
    }

    /** 이름(용어·별칭)이 같은 내보낼 수 있는 카드(채팅 lookup_terms) */
    public Optional<GlossaryTerm> findPublished(String name) {
        return glossaryTermFile.terms().findPublished(name);
    }

    /** 이름이 비슷한 내보낼 수 있는 카드(카드가 없을 때 안내, 최대 limit개) */
    public List<GlossaryTerm> similarPublished(String name, int limit) {
        return glossaryTermFile.terms().similarPublished(name, limit);
    }

    /** 이름이 같은 카드(검토 전 포함). 채팅의 용어 사전 열기 버튼을 남길지 볼 때만 쓴다(내용은 내보내지 않음) */
    public Optional<GlossaryTerm> findAny(String name) {
        return glossaryTermFile.terms().findAny(name);
    }
}
