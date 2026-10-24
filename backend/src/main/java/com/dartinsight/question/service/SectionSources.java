package com.dartinsight.question.service;

import com.dartinsight.analysis.domain.TextChange;
import com.dartinsight.analysis.domain.TextChangeFilter;
import com.dartinsight.analysis.domain.TextChangeRow;
import com.dartinsight.analysis.domain.TextChangeRow.Side;
import com.dartinsight.document.domain.DocumentBlock;
import com.dartinsight.question.domain.QuestionSource;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * 섹션 이름이 든 질문의 후보 고르기(3.10, #258).
 * <ol>
 *   <li>질문과 이 분석의 섹션 제목(문장 변경의 섹션 경로에 나오는 대목차·하위 목차)을 같은 꼴로 바꾼다:
 *   공백·따옴표·괄호를 빼고 소문자로, 제목은 앞 번호(II. · 7. · 가. · (1))를 뗀다.</li>
 *   <li>4자 미만 제목과 목차 밖 본문은 보지 않는다. 질문에 들어 있는 제목 중 가장 긴 것을 고르고(같으면 문서 순서),
 *   하위 목차면 그 하위 섹션까지, 대목차면 대목차가 범위다.</li>
 *   <li>범위 안 변경(추가·삭제·수정) 중 글이 있는 쪽을 확인 우선순위 점수가 높은 순(점수 없으면 뒤), 같으면 문서 순서로
 *   현재 쪽 → 이전 쪽 문단을 후보로 삼아 최대 6개, 글은 1,200자까지 보낸다.</li>
 * </ol>
 */
public final class SectionSources {

    static final int MIN_TITLE_LENGTH = 4;
    static final String OUTSIDE_TOC = "(목차 밖 본문)";

    private static final Pattern SPACES_AND_QUOTES = Pattern.compile("[\\s'\"‘’“”`「」『』【】\\[\\]<>《》〈〉]+");
    private static final Pattern LEADING_NUMBER = Pattern.compile(
            "^(?:\\(\\d+\\)|\\d+[.)]|[ivxlcdm]+[.)]|[가-힣][.)])+");
    private static final Set<String> TYPES = Set.of(TextChangeRow.ADDED, TextChangeRow.DELETED,
            TextChangeRow.MODIFIED);

    private SectionSources() {
    }

    /** 질문이 가리키는 섹션 범위(섹션 경로 앞부분). 없으면 빈 값 */
    public static Optional<String> scope(String question, List<String> sectionPaths) {
        String compactQuestion = normalize(question);
        if (compactQuestion.isEmpty()) {
            return Optional.empty();
        }
        Map<String, String> scopes = new LinkedHashMap<>();
        for (String path : sectionPaths) {
            if (path == null || path.isBlank()) {
                continue;
            }
            String[] titles = path.split(Pattern.quote(TextChangeFilter.PATH_SEPARATOR));
            StringBuilder prefix = new StringBuilder();
            for (String title : titles) {
                if (!prefix.isEmpty()) {
                    prefix.append(TextChangeFilter.PATH_SEPARATOR);
                }
                prefix.append(title);
                if (OUTSIDE_TOC.equals(title.strip())) {
                    continue;
                }
                String key = title(title);
                if (key.length() >= MIN_TITLE_LENGTH) {
                    scopes.putIfAbsent(key, prefix.toString());
                }
            }
        }
        String best = null;
        for (String key : scopes.keySet()) {
            if (compactQuestion.contains(key) && (best == null || key.length() > best.length())) {
                best = key;
            }
        }
        return Optional.ofNullable(best).map(scopes::get);
    }

    /** 공백·따옴표·괄호를 빼고 소문자로 바꾼 글 */
    static String normalize(String text) {
        return text == null ? "" : SPACES_AND_QUOTES.matcher(text.toLowerCase(Locale.ROOT)).replaceAll("");
    }

    /** 비교할 제목: normalize한 뒤 앞 번호를 뗀다 */
    static String title(String title) {
        return LEADING_NUMBER.matcher(normalize(title)).replaceFirst("");
    }

    /** 범위 안 변경으로 만든 후보 문단 */
    public static List<QuestionSource> sources(List<TextChange> changes) {
        List<TextChange> ordered = changes.stream().filter(c -> TYPES.contains(c.row().changeType()))
                .sorted(Comparator.comparing((TextChange c) -> score(c), Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparingInt(TextChange::changeNo))
                .toList();
        Set<String> seen = new LinkedHashSet<>();
        List<QuestionSource> sources = new ArrayList<>();
        for (TextChange change : ordered) {
            add(sources, seen, change.row().current(), QuestionSource.CURRENT, change.row().sectionPath());
            add(sources, seen, change.row().previous(), QuestionSource.PREVIOUS, change.row().sectionPath());
            if (sources.size() >= QuestionRetriever.MAX_SOURCES) {
                break;
            }
        }
        return sources.size() <= QuestionRetriever.MAX_SOURCES ? sources
                : List.copyOf(sources.subList(0, QuestionRetriever.MAX_SOURCES));
    }

    private static Integer score(TextChange change) {
        TextChangeRow.Priority priority = change.row().priority();
        return priority == null ? null : priority.score();
    }

    private static void add(List<QuestionSource> sources, Set<String> seen, Side side, String sideName,
            String sectionPath) {
        if (side == null || side.blockNo() == null || side.text() == null || side.text().isBlank()) {
            return;
        }
        String evidenceId = DocumentBlock.evidenceId(side.rceptNo(), side.blockNo());
        if (!seen.add(evidenceId)) {
            return;
        }
        String text = side.text().length() <= QuestionRetriever.MAX_SOURCE_CHARS ? side.text()
                : side.text().substring(0, QuestionRetriever.MAX_SOURCE_CHARS);
        sources.add(new QuestionSource(evidenceId, sideName, side.rceptNo(), side.sectionNo(), side.blockNo(),
                sectionPath == null ? "" : sectionPath, text));
    }
}
