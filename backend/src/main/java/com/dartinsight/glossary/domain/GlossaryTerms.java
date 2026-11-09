package com.dartinsight.glossary.domain;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 용어 카드 묶음과 그 규칙(ADR-0061). 파일을 읽을 때 한 번 만든다.
 *
 * <p>키나 서로 다른 카드의 이름(용어·별칭)이 겹치거나 관련 용어가 없는 키를 가리키면 만들지 않는다(서버가 뜨지 않음).
 * 이름은 공백을 빼고 비교한다('부채 비율'과 '부채비율'은 같은 이름).
 */
public final class GlossaryTerms {

    private final List<GlossaryTerm> all;

    private GlossaryTerms(List<GlossaryTerm> all) {
        this.all = all;
    }

    /** 규칙을 확인한 카드 묶음. 어기면 IllegalStateException. */
    public static GlossaryTerms of(List<GlossaryTerm> terms) {
        List<GlossaryTerm> all = List.copyOf(terms);
        all.forEach(GlossaryTerms::requireFields);
        requireUniqueKeys(all);
        requireUniqueNames(all);
        requireKnownRelated(all);
        return new GlossaryTerms(all);
    }

    /** 파일의 모든 카드(검토 전 카드 포함). */
    public List<GlossaryTerm> all() {
        return all;
    }

    /**
     * 내보낼 수 있는 카드만. 관련 용어도 내보낼 수 있는 카드만 남긴다(화면이 열 수 없는 키를 주지 않음).
     */
    public List<GlossaryTerm> published() {
        Set<String> publishedKeys = new HashSet<>();
        all.stream().filter(GlossaryTerm::isPublishable).forEach(term -> publishedKeys.add(term.key()));
        return all.stream()
                .filter(GlossaryTerm::isPublishable)
                .map(term -> withRelated(term, term.related().stream().filter(publishedKeys::contains).toList()))
                .toList();
    }

    /** 공백을 뺀 이름. 이름 겹침을 볼 때와 용어를 찾을 때 같은 기준을 쓴다. */
    public static String normalizeName(String name) {
        return name.replaceAll("\s+", "");
    }

    private static void requireFields(GlossaryTerm term) {
        if (isBlank(term.key()) || term.level() == null || isBlank(term.term()) || isBlank(term.definition())) {
            throw new IllegalStateException("용어 카드에 키·수준·용어·한 줄 뜻이 모두 있어야 합니다: " + term.key());
        }
        if (term.aliases().stream().anyMatch(GlossaryTerms::isBlank)) {
            throw new IllegalStateException("용어 카드의 별칭이 비어 있습니다: " + term.key());
        }
    }

    private static void requireUniqueKeys(List<GlossaryTerm> terms) {
        Set<String> keys = new HashSet<>();
        for (GlossaryTerm term : terms) {
            if (!keys.add(term.key())) {
                throw new IllegalStateException("용어 카드 키가 겹칩니다: " + term.key());
            }
        }
    }

    private static void requireUniqueNames(List<GlossaryTerm> terms) {
        Map<String, String> owners = new HashMap<>();
        for (GlossaryTerm term : terms) {
            for (String name : term.names()) {
                // 같은 카드 안에서 띄어쓰기만 다른 별칭('부채 비율')은 일부러 두는 것이라 겹침으로 보지 않는다
                String owner = owners.putIfAbsent(normalizeName(name), term.key());
                if (owner != null && !owner.equals(term.key())) {
                    throw new IllegalStateException("용어 카드 이름이 겹칩니다: " + name + " (" + term.key() + ")");
                }
            }
        }
    }

    private static void requireKnownRelated(List<GlossaryTerm> terms) {
        Set<String> keys = new HashSet<>();
        terms.forEach(term -> keys.add(term.key()));
        for (GlossaryTerm term : terms) {
            for (String related : term.related()) {
                if (!keys.contains(related) || related.equals(term.key())) {
                    throw new IllegalStateException(
                            "용어 카드 " + term.key() + "의 관련 용어가 없는 카드를 가리킵니다: " + related);
                }
            }
        }
    }

    private static GlossaryTerm withRelated(GlossaryTerm term, List<String> related) {
        return new GlossaryTerm(term.key(), term.level(), term.term(), term.aliases(), term.definition(),
                term.example(), term.whereToCheck(), term.noJudgment(), related, term.companyValue(),
                term.sources(), term.reviewer(), term.reviewedAt());
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
