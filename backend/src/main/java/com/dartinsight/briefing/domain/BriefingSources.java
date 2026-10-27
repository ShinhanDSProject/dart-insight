package com.dartinsight.briefing.domain;

import com.dartinsight.document.domain.DocumentBlock;
import com.dartinsight.document.domain.DocumentSection;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * 브리핑 근거 고르기(ADR-0025). 원문 목차 제목으로 고른다(LLM 없이).
 * <ol>
 *   <li>제목에 '사업의 내용'이 든 대목차를 찾는다. 없으면 후보 없음</li>
 *   <li>그 아래 하위 목차 제목으로 주제를 정한다: 사업의 개요 → OVERVIEW, 주요 제품 → PRODUCTS,
 *       매출 → SALES, 위험관리 → RISK. RISK가 모자라면 제목에 '투자자 보호'가 든 대목차에서 채운다</li>
 *   <li>주제마다 40자 이상 문단을 문서 순서로, 모자라면 표로 최대 2개. 글은 2,000자까지</li>
 *   <li>개요·제품·매출을 하나도 찾지 못하면 '사업의 내용' 아래 앞 문단 3개를 개요로 쓴다</li>
 * </ol>
 * 고르는 규칙을 바꾸면 결과가 달라지므로 {@code BriefingService.PROMPT_VERSION}을 올린다.
 */
public final class BriefingSources {

    static final int PER_TOPIC = 2;
    static final int FALLBACK_OVERVIEW = 3;
    static final int MAX_SOURCES = 8;
    static final int MIN_PARAGRAPH = 40;
    static final int MAX_TEXT = 2000;

    private static final String BUSINESS = "사업의내용";
    private static final String INVESTOR_PROTECTION = "투자자보호";
    private static final Map<String, BriefingTopic> KEYWORDS = new LinkedHashMap<>();
    private static final Pattern SPACES = Pattern.compile("\\s+");

    static {
        KEYWORDS.put("사업의개요", BriefingTopic.OVERVIEW);
        KEYWORDS.put("주요제품", BriefingTopic.PRODUCTS);
        KEYWORDS.put("매출", BriefingTopic.SALES);
        KEYWORDS.put("위험관리", BriefingTopic.RISK);
    }

    private BriefingSources() {
    }

    /**
     * @param sections 원문 목차(문서 순서)
     * @param blocks   원문 블록(문서 순서)
     * @param paths    섹션 번호 → 섹션 경로
     */
    public static List<BriefingSource> select(List<DocumentSection> sections, List<DocumentBlock> blocks,
            Map<Integer, String> paths) {
        Optional<DocumentSection> business = topLevel(sections, BUSINESS);
        if (business.isEmpty()) {
            return List.of();
        }
        Map<Integer, List<DocumentSection>> children = new HashMap<>();
        for (DocumentSection section : sections) {
            if (section.parentNo() != null) {
                children.computeIfAbsent(section.parentNo(), k -> new ArrayList<>()).add(section);
            }
        }
        Map<Integer, List<DocumentBlock>> bySection = new HashMap<>();
        for (DocumentBlock block : blocks) {
            bySection.computeIfAbsent(block.sectionNo(), k -> new ArrayList<>()).add(block);
        }

        Map<BriefingTopic, Set<Integer>> topicSections = new EnumMap<>(BriefingTopic.class);
        for (DocumentSection child : children.getOrDefault(business.get().sectionNo(), List.of())) {
            topic(child.title()).ifPresent(topic -> topicSections.computeIfAbsent(topic, k -> new HashSet<>())
                    .addAll(subtree(child.sectionNo(), children)));
        }

        Map<BriefingTopic, List<DocumentBlock>> picked = new EnumMap<>(BriefingTopic.class);
        for (Map.Entry<BriefingTopic, Set<Integer>> entry : topicSections.entrySet()) {
            picked.put(entry.getKey(), pick(blocksIn(entry.getValue(), blocks), PER_TOPIC));
        }
        if (picked.getOrDefault(BriefingTopic.RISK, List.of()).size() < PER_TOPIC) {
            topLevel(sections, INVESTOR_PROTECTION).ifPresent(section -> {
                List<DocumentBlock> risk = new ArrayList<>(picked.getOrDefault(BriefingTopic.RISK, List.of()));
                for (DocumentBlock block : paragraphs(blocksIn(subtree(section.sectionNo(), children), blocks))) {
                    if (risk.size() >= PER_TOPIC) {
                        break;
                    }
                    risk.add(block);
                }
                if (!risk.isEmpty()) {
                    picked.put(BriefingTopic.RISK, risk);
                }
            });
        }
        boolean described = picked.entrySet().stream()
                .anyMatch(e -> e.getKey() != BriefingTopic.RISK && !e.getValue().isEmpty());
        if (!described) {
            List<DocumentBlock> overview = paragraphs(blocksIn(subtree(business.get().sectionNo(), children), blocks));
            picked.put(BriefingTopic.OVERVIEW, overview.subList(0, Math.min(FALLBACK_OVERVIEW, overview.size())));
        }

        List<BriefingSource> sources = new ArrayList<>();
        Set<Integer> used = new HashSet<>();
        for (BriefingTopic topic : BriefingTopic.values()) {
            for (DocumentBlock block : picked.getOrDefault(topic, List.of())) {
                if (sources.size() < MAX_SOURCES && used.add(block.blockNo())) {
                    sources.add(new BriefingSource(block.evidenceId(), topic, block.sectionNo(), block.blockNo(),
                            paths.getOrDefault(block.sectionNo(), ""), clip(block.text().strip())));
                }
            }
        }
        return sources;
    }

    /** 공백을 뺀 제목(앞 번호 'II.'·'1.'는 남아도 낱말 찾기에 문제없다) */
    static String key(String title) {
        return title == null ? "" : SPACES.matcher(title).replaceAll("");
    }

    static Optional<BriefingTopic> topic(String title) {
        String key = key(title);
        return KEYWORDS.entrySet().stream().filter(e -> key.contains(e.getKey())).map(Map.Entry::getValue)
                .findFirst();
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

    private static List<DocumentBlock> blocksIn(Set<Integer> sectionNos, List<DocumentBlock> blocks) {
        return blocks.stream().filter(b -> sectionNos.contains(b.sectionNo())).toList();
    }

    private static List<DocumentBlock> paragraphs(List<DocumentBlock> blocks) {
        return blocks.stream().filter(b -> DocumentBlock.PARAGRAPH.equals(b.type()) && b.text() != null
                && b.text().strip().length() >= MIN_PARAGRAPH).toList();
    }

    /** 문단 먼저(문서 순서), 모자라면 비지 않은 표 */
    private static List<DocumentBlock> pick(List<DocumentBlock> blocks, int limit) {
        List<DocumentBlock> result = new ArrayList<>(paragraphs(blocks));
        blocks.stream().filter(b -> DocumentBlock.TABLE.equals(b.type()) && b.text() != null && !b.text().isBlank())
                .forEach(result::add);
        return result.subList(0, Math.min(limit, result.size()));
    }

    private static String clip(String text) {
        return text.length() <= MAX_TEXT ? text : text.substring(0, MAX_TEXT);
    }
}
