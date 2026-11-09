package com.dartinsight.glossary.domain;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * 용어 카드 묶음과 그 규칙(ADR-0061). 파일을 읽을 때 한 번 만든다.
 *
 * <p>키나 서로 다른 카드의 이름(용어·별칭)이 겹치거나 관련 용어가 없는 키를 가리키면 만들지 않는다(서버가 뜨지 않음).
 * 이름은 공백을 빼고 영문 대소문자를 가리지 않고 비교한다('부채 비율'과 '부채비율', 'CB'와 'cb'는 같은 이름).
 */
public final class GlossaryTerms {

    private static final Pattern WHITE_SPACE = Pattern.compile("\\p{IsWhite_Space}+");
    /** 비슷한 카드로 보는 이름 유사도(글자 두 개씩 묶은 조각의 겹침, 0~1)의 하한 */
    static final double SIMILAR_MIN = 0.4;

    private final List<GlossaryTerm> all;
    private final List<GlossaryTerm> published;

    private GlossaryTerms(List<GlossaryTerm> all) {
        this.all = all;
        this.published = publishable(all);
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
        return published;
    }

    /** 이름(용어·별칭)이 같은 내보낼 수 있는 카드. 채팅 Tool lookup_terms가 쓴다 */
    public Optional<GlossaryTerm> findPublished(String name) {
        return find(published, name);
    }

    /**
     * 이름이 같은 카드(검토 전 카드 포함). 채팅의 용어 사전 열기 버튼(OPEN_GLOSSARY)을 남길지 볼 때만 쓴다.
     * 버튼에는 용어 이름만 담으므로 검토 전 카드의 내용은 나가지 않는다.
     */
    public Optional<GlossaryTerm> findAny(String name) {
        return find(all, name);
    }

    /**
     * 이름이 비슷한 내보낼 수 있는 카드(비슷한 순서, 같으면 파일 순서). 한쪽 이름이 다른 쪽을 품으면 가장 비슷하고,
     * 아니면 글자 두 개씩 묶은 조각이 얼마나 겹치는지로 본다(정의를 지어내지 않고 카드를 가리키기만 함).
     */
    public List<GlossaryTerm> similarPublished(String name, int limit) {
        String query = normalizeName(name);
        if (query.isEmpty()) {
            return List.of();
        }
        record Scored(GlossaryTerm term, double score) {
        }
        return published.stream()
                .map(term -> new Scored(term, term.names().stream()
                        .mapToDouble(n -> similarity(query, normalizeName(n))).max().orElse(0)))
                .filter(s -> s.score() >= SIMILAR_MIN)
                .sorted(Comparator.comparingDouble(Scored::score).reversed())
                .limit(limit)
                .map(Scored::term)
                .toList();
    }

    /**
     * 이름 비교 기준: 유니코드 공백(스페이스·탭·NBSP 등)을 모두 빼고 영문은 소문자로('CB'와 'cb'는 같음).
     * 이름 겹침을 볼 때와 용어를 찾을 때 같은 기준을 쓴다.
     */
    public static String normalizeName(String name) {
        return WHITE_SPACE.matcher(name).replaceAll("").toLowerCase(Locale.ROOT);
    }

    private static Optional<GlossaryTerm> find(List<GlossaryTerm> terms, String name) {
        if (name == null || normalizeName(name).isEmpty()) {
            return Optional.empty();
        }
        String query = normalizeName(name);
        return terms.stream()
                .filter(term -> term.names().stream().anyMatch(n -> normalizeName(n).equals(query)))
                .findFirst();
    }

    /** 0~1. 한쪽이 다른 쪽을 품으면 1, 아니면 글자 두 개 조각의 다이스 계수 */
    static double similarity(String a, String b) {
        if (a.isEmpty() || b.isEmpty()) {
            return 0;
        }
        if (a.contains(b) || b.contains(a)) {
            return 1;
        }
        List<String> left = bigrams(a);
        List<String> right = new ArrayList<>(bigrams(b));
        if (left.isEmpty() || right.isEmpty()) {
            return 0;
        }
        int total = left.size() + right.size();
        int shared = 0;
        for (String piece : left) {
            if (right.remove(piece)) {
                shared++;
            }
        }
        return 2.0 * shared / total;
    }

    private static List<String> bigrams(String text) {
        int[] points = text.codePoints().toArray();
        List<String> pieces = new ArrayList<>();
        for (int i = 0; i + 1 < points.length; i++) {
            pieces.add(new String(points, i, 2));
        }
        return pieces;
    }

    private static List<GlossaryTerm> publishable(List<GlossaryTerm> all) {
        Set<String> publishedKeys = new HashSet<>();
        all.stream().filter(GlossaryTerm::isPublishable).forEach(term -> publishedKeys.add(term.key()));
        return all.stream()
                .filter(GlossaryTerm::isPublishable)
                .map(term -> withRelated(term, term.related().stream().filter(publishedKeys::contains).toList()))
                .toList();
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
