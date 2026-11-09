package com.dartinsight.glossary.dto;

import com.dartinsight.glossary.domain.GlossaryLevel;
import com.dartinsight.glossary.domain.GlossarySource;
import com.dartinsight.glossary.domain.GlossaryTerm;
import java.time.LocalDate;
import java.util.List;

/**
 * 용어 카드 하나(docs/api-spec.md). 검토자와 '이 회사 값을 찾을 곳'은 내보내지 않는다.
 */
public record GlossaryTermResponse(
        String key,
        GlossaryLevel level,
        String term,
        List<String> aliases,
        String definition,
        String example,
        String whereToCheck,
        String noJudgment,
        List<String> related,
        List<Source> sources,
        LocalDate reviewedAt) {

    public static GlossaryTermResponse from(GlossaryTerm term) {
        return new GlossaryTermResponse(term.key(), term.level(), term.term(), term.aliases(), term.definition(),
                term.example(), term.whereToCheck(), term.noJudgment(), term.related(),
                term.sources().stream().map(Source::from).toList(), term.reviewedAt());
    }

    /** 확인한 공식 자료. */
    public record Source(String title, String url) {

        static Source from(GlossarySource source) {
            return new Source(source.title(), source.url());
        }
    }
}
