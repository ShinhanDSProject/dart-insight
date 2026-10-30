package com.dartinsight.disclosure.domain;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 확인해 볼 공시 종류를 정하는 규칙표(FS-55, #411, ADR-0033). LLM을 쓰지 않는다. 규칙은 docs/api-spec.md
 * {@code GET /api/companies/{corpCode}/disclosure-signals}의 표와 같다.
 *
 * <p><b>공시 제목 규칙</b>: 제목은 {@link DisclosureGroupRules#title(String)}(앞머리 꼬리표와 뒤 설명을 떼고 공백을 뺀 값)이다.
 * 제목에 '자회사의주요경영사항'·'종속회사의주요경영사항'이 있으면 자회사의 일이라 어느 종류도 아니다. 제목은
 * 2026-03-16~31·2026-07-01~09-30 OpenDART 공시검색(거래소공시·주요사항보고서) 실제 응답에 나온 것에서만 골랐다.
 * 제목을 더하면 DisclosureSignalRulesTest에 그 보고서명을 함께 넣는다.
 *
 * <p><b>감사의견 규칙</b>: OpenDART 회계감사인의 명칭 및 감사의견(DS002 2020009)의 행에서 당기·전기는 사업연도(bsns_year,
 * 예 "제60기\n(당기)")에 '(당기)'·'(전기)'가 있는 행이다. 감사의견은 공백을 빼고 '한정'·'부적정'·'거절' 중 하나가 있을 때만
 * 적정이 아님으로 본다(2026-10-27 실제 응답에서 '적정의견'·'의견거절'을 확인).
 */
public final class DisclosureSignalRules {

    private static final Pattern SPACES = Pattern.compile("\\s+");

    /** 이 낱말이 제목에 있으면 자회사·종속회사의 일이라 어느 종류에도 넣지 않는다 */
    public static final List<String> SUBSIDIARY_MARKERS = List.of("자회사의주요경영사항", "종속회사의주요경영사항");

    /** 제목이 이 값과 같으면 그 종류 */
    public static final Map<String, DisclosureSignalKind> EXACT_TITLES = exactTitles();

    /** 제목이 이 낱말로 시작하면 그 종류 */
    public static final Map<String, DisclosureSignalKind> TITLE_PREFIXES = Map.of(
            "소송등의제기", DisclosureSignalKind.LITIGATION);

    /** 제목에 이 낱말이 있으면 그 종류 */
    public static final Map<String, DisclosureSignalKind> TITLE_KEYWORDS = titleKeywords();

    /** 공백을 뺀 감사의견에 이 낱말이 있으면 적정이 아님 */
    public static final List<String> NON_CLEAN_OPINION_WORDS = List.of("한정", "부적정", "거절");

    /** 공백을 무시하고 '계속기업'을 찾는다(#546) */
    private static final Pattern GOING_CONCERN = Pattern.compile("계\\s*속\\s*기\\s*업");
    /** 계속기업 문구 원문 일부의 최대 글자 수 */
    public static final int GOING_CONCERN_EXCERPT_LENGTH = 200;
    /** 원문 일부를 '계속기업'이 처음 나온 곳 몇 글자 앞부터 자르는지 */
    static final int GOING_CONCERN_EXCERPT_BEFORE = 60;
    static final String EMPHASIS_MATTER = "강조사항 등";
    static final String SPECIAL_MATTER = "감사보고서 특기사항";

    private static final String CURRENT_TERM = "(당기)";
    private static final String PRIOR_TERM = "(전기)";

    private DisclosureSignalRules() {
    }

    /** 공시 제목으로 정하는 종류(감사 두 종류는 여기서 정하지 않는다) */
    public static Optional<DisclosureSignalKind> classify(String reportName) {
        String title = DisclosureGroupRules.title(reportName);
        if (title.isEmpty() || SUBSIDIARY_MARKERS.stream().anyMatch(title::contains)) {
            return Optional.empty();
        }
        DisclosureSignalKind exact = EXACT_TITLES.get(title);
        if (exact != null) {
            return Optional.of(exact);
        }
        for (Map.Entry<String, DisclosureSignalKind> rule : TITLE_PREFIXES.entrySet()) {
            if (title.startsWith(rule.getKey())) {
                return Optional.of(rule.getValue());
            }
        }
        for (Map.Entry<String, DisclosureSignalKind> rule : TITLE_KEYWORDS.entrySet()) {
            if (title.contains(rule.getKey())) {
                return Optional.of(rule.getValue());
            }
        }
        return Optional.empty();
    }

    /** 감사의견 원문이 적정이 아님(한정·부적정·의견거절)인지. null·'적정의견'·그 밖의 값은 false */
    public static boolean nonClean(String opinion) {
        if (opinion == null) {
            return false;
        }
        String compact = compact(opinion);
        return NON_CLEAN_OPINION_WORDS.stream().anyMatch(compact::contains);
    }

    /** 당기 행 가운데 감사의견이 적정이 아닌 첫 행 */
    public static Optional<AuditOpinionRow> nonCleanOpinion(List<AuditOpinionRow> rows) {
        return rows.stream().filter(r -> isCurrent(r.term()) && nonClean(r.opinion())).findFirst();
    }

    /**
     * 당기와 전기의 감사인이 다르면 그 내용. 감사인은 공백을 빼고 비교하고, 연결·별도처럼 같은 기의 행이 여럿이면 감사인 모음으로
     * 비교한다. 어느 쪽이든 감사인이 없으면 비교하지 않는다.
     */
    public static Optional<AuditorChange> auditorChange(List<AuditOpinionRow> rows) {
        Map<String, String> current = auditors(rows, CURRENT_TERM);
        Map<String, String> prior = auditors(rows, PRIOR_TERM);
        if (current.isEmpty() || prior.isEmpty() || current.keySet().equals(prior.keySet())) {
            return Optional.empty();
        }
        return Optional.of(new AuditorChange(term(rows, PRIOR_TERM), List.copyOf(prior.values()),
                term(rows, CURRENT_TERM), List.copyOf(current.values())));
    }

    /**
     * 당기 행의 강조사항 등(없으면 감사보고서 특기사항)에 공백을 무시하고 '계속기업'이 있는 첫 문구(#546). 핵심감사사항은 보지 않는다.
     * 원문 일부는 처음 나온 곳 {@link #GOING_CONCERN_EXCERPT_BEFORE}자 앞부터 {@link #GOING_CONCERN_EXCERPT_LENGTH}자 이내로 자른
     * 원문 그대로(앞뒤 공백만 뺌)다.
     */
    public static Optional<GoingConcernNote> goingConcern(List<AuditOpinionRow> rows) {
        for (AuditOpinionRow row : rows) {
            if (!isCurrent(row.term())) {
                continue;
            }
            Optional<GoingConcernNote> emphasis = goingConcern(row.term(), EMPHASIS_MATTER, row.emphasisMatter());
            if (emphasis.isPresent()) {
                return emphasis;
            }
            Optional<GoingConcernNote> special = goingConcern(row.term(), SPECIAL_MATTER, row.specialMatter());
            if (special.isPresent()) {
                return special;
            }
        }
        return Optional.empty();
    }

    private static Optional<GoingConcernNote> goingConcern(String term, String field, String text) {
        if (text == null) {
            return Optional.empty();
        }
        Matcher matcher = GOING_CONCERN.matcher(text);
        if (!matcher.find()) {
            return Optional.empty();
        }
        int end = Math.min(text.length(), Math.max(0, matcher.start() - GOING_CONCERN_EXCERPT_BEFORE)
                + GOING_CONCERN_EXCERPT_LENGTH);
        int start = Math.max(0, end - GOING_CONCERN_EXCERPT_LENGTH);
        return Optional.of(new GoingConcernNote(term, field, text.substring(start, end).strip()));
    }

    /** 예: "사업보고서에 적힌 제60기(당기) 감사의견은 '의견거절'이에요." */
    public static String auditOpinionSentence(AuditOpinionRow row) {
        String opinion = row.opinion().strip();
        return "사업보고서에 적힌 " + row.term() + " 감사의견은 '" + opinion + "'" + (hasFinalConsonant(opinion)
                ? "이에요." : "예요.");
    }

    /** 예: "사업보고서에 적힌 감사인이 제59기(전기) 현대회계법인에서 제60기(당기) 대주회계법인으로 바뀌었어요." */
    public static String auditorChangeSentence(AuditorChange change) {
        String before = String.join(", ", change.previousAuditors());
        String after = String.join(", ", change.currentAuditors());
        return "사업보고서에 적힌 감사인이 " + change.previousTerm() + " " + before + "에서 " + change.currentTerm() + " "
                + after + towardParticle(after) + " 바뀌었어요.";
    }

    /** 사업연도 원문(예 "제60기\n(당기)")의 공백을 모두 뺀 값 */
    public static String compact(String value) {
        return value == null ? null : SPACES.matcher(value).replaceAll("");
    }

    static boolean isCurrent(String term) {
        return term != null && term.contains(CURRENT_TERM);
    }

    /** 공백을 뺀 감사인 → 처음 나온 원문(앞뒤 공백만 뺌). 순서는 응답 순서 */
    private static Map<String, String> auditors(List<AuditOpinionRow> rows, String marker) {
        Map<String, String> auditors = new LinkedHashMap<>();
        for (AuditOpinionRow row : rows) {
            if (row.term() != null && row.term().contains(marker) && row.auditor() != null) {
                auditors.putIfAbsent(compact(row.auditor()), row.auditor().strip());
            }
        }
        return auditors;
    }

    private static String term(List<AuditOpinionRow> rows, String marker) {
        Set<String> terms = new LinkedHashSet<>();
        for (AuditOpinionRow row : rows) {
            if (row.term() != null && row.term().contains(marker)) {
                terms.add(row.term());
            }
        }
        return terms.iterator().next();
    }

    /** '으로'·'로': 받침이 없거나 ㄹ 받침이면 '로' */
    private static String towardParticle(String word) {
        char last = word.charAt(word.length() - 1);
        if (!isHangulSyllable(last)) {
            return "(으)로";
        }
        int finalConsonant = (last - 0xAC00) % 28;
        return finalConsonant == 0 || finalConsonant == 8 ? "로" : "으로";
    }

    private static boolean hasFinalConsonant(String word) {
        char last = word.charAt(word.length() - 1);
        return !isHangulSyllable(last) || (last - 0xAC00) % 28 != 0;
    }

    private static boolean isHangulSyllable(char c) {
        return c >= 0xAC00 && c <= 0xD7A3;
    }

    private static Map<String, DisclosureSignalKind> exactTitles() {
        Map<String, DisclosureSignalKind> titles = new LinkedHashMap<>();
        titles.put("최대주주변경", DisclosureSignalKind.LARGEST_SHAREHOLDER_CHANGE);
        titles.put("주요사항보고서(유상증자결정)", DisclosureSignalKind.CAPITAL_INCREASE);
        titles.put("주요사항보고서(유무상증자결정)", DisclosureSignalKind.CAPITAL_INCREASE);
        titles.put("유상증자결정", DisclosureSignalKind.CAPITAL_INCREASE);
        titles.put("유무상증자결정", DisclosureSignalKind.CAPITAL_INCREASE);
        titles.put("주요사항보고서(전환사채권발행결정)", DisclosureSignalKind.CONVERTIBLE_BOND);
        titles.put("주요사항보고서(신주인수권부사채권발행결정)", DisclosureSignalKind.BOND_WITH_WARRANT);
        titles.put("주요사항보고서(소송등의제기)", DisclosureSignalKind.LITIGATION);
        return Map.copyOf(titles);
    }

    private static Map<String, DisclosureSignalKind> titleKeywords() {
        Map<String, DisclosureSignalKind> keywords = new LinkedHashMap<>();
        keywords.put("회생절차", DisclosureSignalKind.REHABILITATION_LISTING);
        keywords.put("회생계획", DisclosureSignalKind.REHABILITATION_LISTING);
        keywords.put("상장폐지", DisclosureSignalKind.REHABILITATION_LISTING);
        keywords.put("관리종목", DisclosureSignalKind.REHABILITATION_LISTING);
        keywords.put("상장적격성실질심사", DisclosureSignalKind.REHABILITATION_LISTING);
        return Map.copyOf(keywords);
    }

    /**
     * 사업보고서에 적힌 전기·당기 감사인.
     *
     * @param previousTerm 전기 사업연도(공백을 뺀 값, 예 "제59기(전기)")
     * @param currentTerm  당기 사업연도
     */
    public record AuditorChange(String previousTerm, List<String> previousAuditors, String currentTerm,
            List<String> currentAuditors) {
    }

    /**
     * 감사의견 자료의 계속기업 문구(#546).
     *
     * @param term    사업연도(공백을 뺀 값, 예 "제16기(당기)")
     * @param field   찾은 필드 이름('강조사항 등' 또는 '감사보고서 특기사항')
     * @param excerpt 원문 일부({@link #GOING_CONCERN_EXCERPT_LENGTH}자 이내, 원문 그대로)
     */
    public record GoingConcernNote(String term, String field, String excerpt) {
    }
}
