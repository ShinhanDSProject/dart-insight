package com.dartinsight.outlook.domain;

import com.dartinsight.document.domain.DocumentBlock;
import com.dartinsight.document.domain.DocumentSection;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Stream;

/**
 * 회사가 밝힌 전망·계획의 근거 고르기(ADR-0039). 원문 목차 제목과 낱말로 고른다(LLM 없이).
 * <ol>
 *   <li>대상 목차: 제목에 '이사의 경영진단'이 든 대목차 아래 전부, 그리고 '사업의 내용' 대목차 아래에서 제목에
 *       {@link #SECTION_KEYWORDS} 중 하나가 든 목차와 그 아래</li>
 *   <li>그 목차들의 문단(40자 미만 소제목은 뺌, 표는 쓰지 않음) 중 {@link #PLAN_WORDS}가 든 문단을 먼저,
 *       모자라면 낱말 없는 문단으로 채워 최대 12개. 보낼 때는 문서 순서. 글은 2,000자까지</li>
 * </ol>
 * 결과가 비면 근거 없음(NO_SOURCE), 낱말 든 문단이 없으면({@link #anyPlanned}) AI를 부르지 않고 EMPTY다.
 * 규칙을 바꾸면 결과가 달라지므로 {@code OutlookService.PROMPT_VERSION}을 올린다.
 */
public final class OutlookSources {

    static final int MAX_SOURCES = 12;
    static final int MIN_PARAGRAPH = 40;
    static final int MAX_TEXT = 2000;

    /** 대목차 제목(공백 뺌)에 든 낱말 */
    static final String MDNA = "이사의경영진단";
    static final String BUSINESS = "사업의내용";
    /** '사업의 내용' 아래 목차 제목(공백 뺌)에 든 낱말. 하나라도 들면 그 목차와 그 아래가 대상이다 */
    public static final List<String> SECTION_KEYWORDS = List.of(
            "생산설비", "설비투자", "시설투자", "투자계획", "신규사업", "연구개발", "기타참고사항");
    /** 계획·전망 낱말. 하나라도 든 문단을 먼저 고른다 */
    public static final List<String> PLAN_WORDS = List.of(
            "계획", "예정", "목표", "전망", "추진", "투자할", "확대", "신규", "출시", "증설", "착공", "방침");

    private static final Pattern SPACES = Pattern.compile("\\s+");

    private OutlookSources() {
    }

    /**
     * @param sections 원문 목차(문서 순서)
     * @param blocks   원문 블록(문서 순서)
     * @param paths    섹션 번호 → 섹션 경로
     */
    public static List<OutlookSource> select(List<DocumentSection> sections, List<DocumentBlock> blocks,
            Map<Integer, String> paths) {
        Set<Integer> targets = targetSections(sections);
        if (targets.isEmpty()) {
            return List.of();
        }
        List<DocumentBlock> paragraphs = blocks.stream().filter(b -> targets.contains(b.sectionNo()))
                .filter(OutlookSources::usableParagraph).toList();
        List<DocumentBlock> picked = Stream.concat(paragraphs.stream().filter(b -> planned(b.text())),
                paragraphs.stream().filter(b -> !planned(b.text()))).limit(MAX_SOURCES)
                .sorted(Comparator.comparingInt(DocumentBlock::blockNo)).toList();
        return picked.stream().map(b -> new OutlookSource(b.evidenceId(), b.sectionNo(), b.blockNo(),
                paths.getOrDefault(b.sectionNo(), ""), clip(b.text().strip()), planned(b.text()))).toList();
    }

    /** 계획·전망 낱말이 든 문단이 하나라도 있는지. 없으면 AI를 부르지 않는다 */
    public static boolean anyPlanned(List<OutlookSource> sources) {
        return sources.stream().anyMatch(OutlookSource::planned);
    }

    static boolean planned(String text) {
        return text != null && PLAN_WORDS.stream().anyMatch(text::contains);
    }

    /** 경영진단 대목차 아래 전부 + '사업의 내용' 아래 대상 제목의 목차와 그 아래 */
    private static Set<Integer> targetSections(List<DocumentSection> sections) {
        Map<Integer, List<DocumentSection>> children = children(sections);
        Set<Integer> targets = new HashSet<>();
        topLevel(sections, MDNA).ifPresent(s -> targets.addAll(subtree(s.sectionNo(), children)));
        topLevel(sections, BUSINESS).ifPresent(business -> {
            for (int no : subtree(business.sectionNo(), children)) {
                if (no != business.sectionNo() && targetTitle(title(sections, no))) {
                    targets.addAll(subtree(no, children));
                }
            }
        });
        return targets;
    }

    static boolean targetTitle(String title) {
        String key = key(title);
        return SECTION_KEYWORDS.stream().anyMatch(key::contains);
    }

    private static String title(List<DocumentSection> sections, int sectionNo) {
        return sections.stream().filter(s -> s.sectionNo() == sectionNo).map(DocumentSection::title).findFirst()
                .orElse("");
    }

    private static Map<Integer, List<DocumentSection>> children(List<DocumentSection> sections) {
        Map<Integer, List<DocumentSection>> children = new HashMap<>();
        for (DocumentSection section : sections) {
            if (section.parentNo() != null) {
                children.computeIfAbsent(section.parentNo(), k -> new ArrayList<>()).add(section);
            }
        }
        return children;
    }

    private static Optional<DocumentSection> topLevel(List<DocumentSection> sections, String keyword) {
        return sections.stream().filter(s -> s.parentNo() == null && !s.cover() && key(s.title()).contains(keyword))
                .findFirst();
    }

    private static Set<Integer> subtree(int sectionNo, Map<Integer, List<DocumentSection>> children) {
        Set<Integer> result = new HashSet<>();
        List<Integer> stack = new ArrayList<>(List.of(sectionNo));
        while (!stack.isEmpty()) {
            int no = stack.removeLast();
            if (result.add(no)) {
                children.getOrDefault(no, List.of()).forEach(c -> stack.add(c.sectionNo()));
            }
        }
        return result;
    }

    private static boolean usableParagraph(DocumentBlock block) {
        return DocumentBlock.PARAGRAPH.equals(block.type()) && block.text() != null
                && block.text().strip().length() >= MIN_PARAGRAPH;
    }

    private static String key(String title) {
        return title == null ? "" : SPACES.matcher(title).replaceAll("");
    }

    private static String clip(String text) {
        return text.length() <= MAX_TEXT ? text : text.substring(0, MAX_TEXT);
    }
}
