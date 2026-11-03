package com.dartinsight.question.domain;

import com.dartinsight.document.domain.DocumentBlock;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * 질문의 후보 문단 찾기(ADR-0023). 벡터 검색이 들어오기 전까지 쓰는 낱말 검색이다.
 * <ol>
 *   <li>질문을 글자·숫자가 아닌 곳에서 끊고, 2자 미만 낱말을 버린다.</li>
 *   <li>3자 이상 낱말은 끝의 조사(은·는·이·가·을·를·에·의·로·으로·과·와·도·에서·까지) 하나를 뗀다.
 *   낱말의 원래 끝 글자를 떼는 경우가 있어도(매출원가 → 매출원) 문단 안에 들어 있는지로 보므로 원래 낱말은 그대로 찾는다.</li>
 *   <li>의문·요청 낱말(왜, 무엇, 어떻게, …나요, …주세요)과 너무 흔한 낱말(관련, 내용, 변화)은 버린다.</li>
 *   <li>3자 이상이고 '액'으로 끝나는 낱말은 '액'을 뗀 말도 같은 낱말로 본다. 공시는 매출액을 '매출은 … 증가'처럼
 *   쓰는 일이 많다(삼성전자 20260814003699 B100·B140, #600).</li>
 *   <li>두 보고서의 문단(PARAGRAPH)마다 낱말이 몇 개(서로 다른 것) 들어 있는지 센다(공백 무시).
 *   질문에 증감 방향(늘·증가, 줄·감소)이 있으면 그 방향 낱말이 든 문단에 1점을 더한다. 최소 점수 판정에는 넣지 않는다.</li>
 *   <li>점수가 높은 순, 같으면 문장(…다.)이 든 문단을 제목 줄·목록 항목보다 먼저, 그다음 현재 보고서 먼저, 문서 순서로
 *   최대 6개를 고른다. 문단 글은 1,200자까지 보낸다.</li>
 * </ol>
 */
public final class QuestionRetriever {

    static final int MAX_SOURCES = 6;
    static final int MAX_SOURCE_CHARS = 1200;
    public static final int MIN_TERM_LENGTH = 2;
    static final int MIN_STRIP_LENGTH = 3;

    /** 긴 것부터 맞춘다(으로가 로보다, 에서가 에보다 먼저) */
    private static final List<String> PARTICLES = List.of("에서", "까지", "으로", "은", "는", "이", "가", "을", "를",
            "에", "의", "로", "과", "와", "도");
    private static final Set<String> STOP_WORDS = Set.of("왜", "무엇", "무엇인가요", "무엇인지", "뭐", "뭔가요", "무슨",
            "어떻게", "어떤", "어느", "어디", "언제", "얼마", "얼마나", "있나요", "없나요", "했나요", "되었나요", "됐나요",
            "바뀌었나요", "달라졌나요", "알려", "알려줘", "알려주세요", "주세요", "설명", "설명해", "관련", "관련된", "내용",
            "변화", "대해", "대한", "대해서", "이유", "원인", "늘어난", "줄어든", "늘어", "줄어", "바뀐", "달라진", "새로",
            "생긴");
    private static final List<String> QUESTION_ENDINGS = List.of("나요", "까요", "가요", "세요", "니까");
    /** 떼어도 같은 낱말로 보는 끝 글자(매출액 → 매출) */
    private static final String AMOUNT_SUFFIX = "액";
    /** 질문에 이 말이 있으면 문단에서 방향 낱말을 찾아 1점을 더한다 */
    private static final List<String> INCREASE_CUES = List.of("늘", "증가");
    private static final List<String> INCREASE_WORDS = List.of("증가", "늘어", "늘었");
    private static final List<String> DECREASE_CUES = List.of("줄", "감소");
    private static final List<String> DECREASE_WORDS = List.of("감소", "줄어", "줄었");
    private static final Pattern SENTENCE_END = Pattern.compile("다\\.|다$");

    private QuestionRetriever() {
    }

    /** 질문에서 찾을 낱말(소문자, 처음 나온 순서, 겹치지 않음) */
    public static List<String> terms(String question) {
        Set<String> terms = new LinkedHashSet<>();
        if (question == null) {
            return List.of();
        }
        for (String raw : question.toLowerCase(Locale.ROOT).split("[^\\p{L}\\p{N}]+")) {
            String token = stripParticle(raw);
            if (token.length() < MIN_TERM_LENGTH || STOP_WORDS.contains(token) || STOP_WORDS.contains(raw)
                    || QUESTION_ENDINGS.stream().anyMatch(raw::endsWith)) {
                continue;
            }
            terms.add(token);
        }
        return List.copyOf(terms);
    }

    static String stripParticle(String token) {
        if (token.length() < MIN_STRIP_LENGTH) {
            return token;
        }
        for (String particle : PARTICLES) {
            if (token.endsWith(particle) && token.length() - particle.length() >= MIN_TERM_LENGTH) {
                return token.substring(0, token.length() - particle.length());
            }
        }
        return token;
    }

    /** 문단에 들어 있는 서로 다른 낱말 수(공백·대소문자 무시) */
    /**
     * 후보가 되려면 질문 낱말의 절반 이상(올림)이 들어 있어야 한다. 낱말 하나만 겹친 엉뚱한 문단
     * (예: '우주 탐사 계획'에 '자기주식 처분 계획')을 근거처럼 보내지 않기 위해서다.
     */
    static int minScore(int termCount) {
        return Math.max(1, (termCount + 1) / 2);
    }

    static int score(List<String> terms, String text) {
        String compact = compact(text);
        int score = 0;
        for (String term : terms) {
            if (variants(term).stream().anyMatch(compact::contains)) {
                score++;
            }
        }
        return score;
    }

    /** 낱말과 같은 낱말로 보는 말. 예: 매출액 → [매출액, 매출] */
    static List<String> variants(String term) {
        if (term.length() >= MIN_STRIP_LENGTH && term.endsWith(AMOUNT_SUFFIX)) {
            return List.of(term, term.substring(0, term.length() - AMOUNT_SUFFIX.length()));
        }
        return List.of(term);
    }

    /** 질문의 증감 방향에 맞는 문단 낱말. 방향이 없으면 빈 목록 */
    static List<String> directionWords(String question) {
        String compact = compact(question);
        List<String> words = new ArrayList<>();
        if (INCREASE_CUES.stream().anyMatch(compact::contains)) {
            words.addAll(INCREASE_WORDS);
        }
        if (DECREASE_CUES.stream().anyMatch(compact::contains)) {
            words.addAll(DECREASE_WORDS);
        }
        return List.copyOf(words);
    }

    /** 문장(…다.)이 든 문단인지. 제목 줄('(3) 판매경로별 매출액 비중')·목록 항목은 아니다 */
    static boolean isSentence(String text) {
        return SENTENCE_END.matcher(text.strip()).find();
    }

    /**
     * 두 보고서에서 고른 후보 문단.
     *
     * @param question     사용자의 질문(낱말과 증감 방향을 여기서 뽑는다)
     * @param current      현재 보고서의 블록(문서 순서)
     * @param previous     이전 보고서의 블록(문서 순서)
     * @param currentPaths 현재 보고서의 섹션 번호 → 섹션 경로
     */
    public static List<QuestionSource> sources(String question, List<DocumentBlock> current,
            Map<Integer, String> currentPaths, List<DocumentBlock> previous, Map<Integer, String> previousPaths) {
        List<String> terms = terms(question);
        if (terms.isEmpty()) {
            return List.of();
        }
        List<String> direction = directionWords(question);
        List<Scored> scored = new ArrayList<>();
        collect(scored, terms, direction, current, currentPaths, QuestionSource.CURRENT, 0);
        collect(scored, terms, direction, previous, previousPaths, QuestionSource.PREVIOUS, 1);
        scored.sort(Comparator.comparingInt((Scored s) -> -s.score())
                .thenComparing(Scored::sentence, Comparator.reverseOrder())
                .thenComparingInt(Scored::sideOrder)
                .thenComparingInt(Scored::order));
        return scored.stream().limit(MAX_SOURCES).map(Scored::source).toList();
    }

    private static void collect(List<Scored> scored, List<String> terms, List<String> direction,
            List<DocumentBlock> blocks, Map<Integer, String> paths, String side, int sideOrder) {
        for (int i = 0; i < blocks.size(); i++) {
            DocumentBlock block = blocks.get(i);
            if (!DocumentBlock.PARAGRAPH.equals(block.type()) || block.text() == null) {
                continue;
            }
            int score = score(terms, block.text());
            if (score < minScore(terms.size())) {
                continue;
            }
            String compact = compact(block.text());
            if (direction.stream().anyMatch(compact::contains)) {
                score++;
            }
            String text = block.text().length() <= MAX_SOURCE_CHARS ? block.text()
                    : block.text().substring(0, MAX_SOURCE_CHARS);
            scored.add(new Scored(score, isSentence(block.text()), sideOrder, i, new QuestionSource(
                    block.evidenceId(), side, block.rceptNo(), block.sectionNo(), block.blockNo(),
                    paths.getOrDefault(block.sectionNo(), ""), text)));
        }
    }

    /** 공백을 빼고 소문자로 바꾼 글 */
    public static String compact(String text) {
        return text == null ? "" : text.replaceAll("\\s+", "").toLowerCase(Locale.ROOT);
    }

    private record Scored(int score, boolean sentence, int sideOrder, int order, QuestionSource source) {
    }
}
