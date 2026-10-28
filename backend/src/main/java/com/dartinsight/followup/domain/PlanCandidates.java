package com.dartinsight.followup.domain;

import com.dartinsight.document.domain.DocumentBlock;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;
import java.util.regex.Pattern;

/**
 * 계획마다 올해 사업보고서 문단에서 후보를 고르는 BM25 색인(ADR-0041). LLM 없이 같은 입력이면 같은 후보가 같은 순서로 나온다.
 * <ul>
 *   <li>식은 ADR-0036(ai-server app/summary/search.py)과 같다: 공백을 뺀 글의 글자 2개 단위, Okapi BM25
 *       k1 = {@value #K1}, b = {@value #B}, 검색어 쪽 글자 2개는 겹침 없이</li>
 *   <li>문단(PARAGRAPH)만, 공백을 뺀 길이 {@value #MIN_CHARS}자 미만은 뺀다. 섹션 가중치는 쓰지 않는다</li>
 *   <li>검색어는 계획의 요지와 인용. 점수가 0보다 큰 문단 중 상위 {@value #LIMIT}개(같으면 블록 번호가 앞선 것)</li>
 *   <li>보내는 글은 {@value #MAX_TEXT}자까지</li>
 * </ul>
 * 규칙을 바꾸면 결과가 달라지므로 {@code PlanFollowupService.PROMPT_VERSION}을 올린다.
 */
public final class PlanCandidates {

    static final int LIMIT = 3;
    static final int MIN_CHARS = 40;
    static final int MAX_TEXT = 2000;
    static final double K1 = 1.5;
    static final double B = 0.75;

    private static final Pattern SPACES = Pattern.compile("\\s+");

    private final List<DocumentBlock> paragraphs;
    private final Map<Integer, String> paths;
    private final List<Map<String, Integer>> counts = new ArrayList<>();
    private final List<Integer> lengths = new ArrayList<>();
    private final Map<String, Integer> documentFrequency = new HashMap<>();
    private final double average;

    private PlanCandidates(List<DocumentBlock> paragraphs, Map<Integer, String> paths) {
        this.paragraphs = paragraphs;
        this.paths = paths;
        long total = 0;
        for (DocumentBlock block : paragraphs) {
            Map<String, Integer> count = new HashMap<>();
            List<String> grams = bigrams(compact(block.text()));
            grams.forEach(g -> count.merge(g, 1, Integer::sum));
            counts.add(count);
            lengths.add(grams.size());
            total += grams.size();
            count.keySet().forEach(g -> documentFrequency.merge(g, 1, Integer::sum));
        }
        this.average = paragraphs.isEmpty() ? 0 : (double) total / paragraphs.size();
    }

    /**
     * @param blocks 올해 보고서 원문 블록(문서 순서)
     * @param paths  섹션 번호 → 섹션 경로
     */
    public static PlanCandidates of(List<DocumentBlock> blocks, Map<Integer, String> paths) {
        return new PlanCandidates(blocks.stream().filter(PlanCandidates::usable).toList(), paths);
    }

    /** 쓸 문단이 하나도 없으면 true(대조하지 않음) */
    public boolean isEmpty() {
        return paragraphs.isEmpty();
    }

    /** 계획 번호 → 후보(점수 순). 후보가 없는 계획은 빈 목록 */
    public Map<Integer, List<PlanCandidate>> forPlans(List<CompanyPlan> plans) {
        Map<Integer, List<PlanCandidate>> result = new LinkedHashMap<>();
        for (CompanyPlan plan : plans) {
            result.put(plan.planNo(), candidates(plan.summary(), plan.quote()));
        }
        return result;
    }

    /** 검색어 글들의 글자 2개 단위로 점수를 매긴 상위 후보 */
    List<PlanCandidate> candidates(String... queries) {
        TreeSet<String> grams = new TreeSet<>();
        for (String query : queries) {
            grams.addAll(bigrams(compact(query)));
        }
        List<double[]> scored = new ArrayList<>();
        for (int i = 0; i < paragraphs.size(); i++) {
            double score = bm25(i, grams);
            if (score > 0) {
                scored.add(new double[] {score, paragraphs.get(i).blockNo(), i});
            }
        }
        scored.sort(Comparator.<double[]>comparingDouble(s -> -s[0]).thenComparingDouble(s -> s[1]));
        return scored.stream().limit(LIMIT).map(s -> candidate(paragraphs.get((int) s[2]))).toList();
    }

    private double bm25(int position, TreeSet<String> grams) {
        Map<String, Integer> count = counts.get(position);
        double norm = average > 0 ? K1 * (1 - B + B * lengths.get(position) / average) : K1;
        double score = 0;
        for (String gram : grams) {
            int tf = count.getOrDefault(gram, 0);
            if (tf > 0) {
                score += idf(gram) * tf * (K1 + 1) / (tf + norm);
            }
        }
        return score;
    }

    private double idf(String gram) {
        int n = paragraphs.size();
        int df = documentFrequency.getOrDefault(gram, 0);
        return Math.log(1 + (n - df + 0.5) / (df + 0.5));
    }

    private PlanCandidate candidate(DocumentBlock block) {
        String text = block.text().strip();
        String sent = text.length() <= MAX_TEXT ? text : text.substring(0, MAX_TEXT);
        return new PlanCandidate(block.evidenceId(), block.rceptNo(), block.sectionNo(), block.blockNo(),
                paths.getOrDefault(block.sectionNo(), ""), sent);
    }

    private static boolean usable(DocumentBlock block) {
        return DocumentBlock.PARAGRAPH.equals(block.type()) && block.text() != null
                && compact(block.text()).length() >= MIN_CHARS;
    }

    static String compact(String text) {
        return text == null ? "" : SPACES.matcher(text).replaceAll("");
    }

    /** 글자 2개 단위. 한 글자면 그 글자 하나 */
    static List<String> bigrams(String text) {
        if (text.length() < 2) {
            return text.isEmpty() ? List.of() : List.of(text);
        }
        List<String> grams = new ArrayList<>(text.length() - 1);
        for (int i = 0; i < text.length() - 1; i++) {
            grams.add(text.substring(i, i + 2));
        }
        return grams;
    }
}
