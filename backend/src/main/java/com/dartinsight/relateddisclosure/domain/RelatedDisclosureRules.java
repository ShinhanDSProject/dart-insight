package com.dartinsight.relateddisclosure.domain;

import com.dartinsight.disclosure.domain.DisclosureGroupRules;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * 관련 수시공시 1단계 '같은 종류'(TYPE_ONLY) 규칙 사전 v1(3.6, ADR-0030). LLM을 쓰지 않는다.
 *
 * <p>변경 쪽은 섹션 경로나 글에 규칙의 낱말이 들어 있으면 걸리고, 공시 쪽은 정리한 제목에 규칙의 패턴이 들어 있으면 걸린다.
 * 둘이 같은 규칙에 걸릴 때만 연결한다. 양쪽 모두 공백을 뺀 뒤 부분 일치로 본다. 제목 정리는
 * {@link DisclosureGroupRules#title}과 같다. 한 쌍이 여러 규칙에 걸리면 {@link #RULES} 순서의 첫 규칙을 남긴다.
 *
 * <p>변경 쪽 낱말은 EVD-04 기획서 5장, 제목 패턴은 사전 조사(docs/research/3.6-related-disclosure.md) 2장의 수정안이다:
 * earnings '잠정실적' → '(잠정)실적', debt-financing에서 '자기주식' 뺌(주주환원 공시만 걸림), restructuring '분할' →
 * '회사분할'(주식분할 제외). 자회사 공시는 결정 로그가 정해질 때까지 빼지 않는다.
 *
 * <p>related-3에서 M8 측정(#345)에 맞춰 변경 쪽 낱말을 좁혔다(ADR-0038): 소송 섹션 '우발부채', 공급계약 섹션 '주요계약'과
 * 글 '계약'·'공급', 자본 조달 섹션·글 '자본금'과 섹션 '주식의총수', 투자 글 '취득'·'투자'를 빼거나 더 구체적인 말로 바꾸고,
 * 실적은 섹션 경로에 '재무제표'가 있을 때만 본다.
 *
 * <p>결과가 달라지게 바꾸면 {@link #RULE_VERSION}을 올린다(분석 버전은 올리지 않는다. 다음 요청 때 새 버전으로 다시 계산).
 */
public final class RelatedDisclosureRules {

    /**
     * 연결 규칙 버전. related_disclosure_run.rule_version. related-2: 주요정보로 '내용 일치' 판정을 더함(#341).
     * related-3: 변경 쪽 낱말을 좁히고 소송 '내용 일치'에 사건 명칭을 요구함(#436, ADR-0038)
     */
    public static final String RULE_VERSION = "related-3";

    private static final Pattern SPACES = Pattern.compile("\\s+");
    /** 앞머리 꼬리표 중 정정을 뜻하는 것([기재정정]·[첨부정정] 등) */
    private static final Pattern CORRECTION_TAG = Pattern.compile("^(?:\\s*\\[[^\\]]*\\])*\\s*\\[[^\\]]*정정[^\\]]*\\]");

    /**
     * @param key           규칙 키(related_disclosure.match_rule, 화면의 연결 이유)
     * @param sectionWords  섹션 경로에 대는 낱말(공백 없음)
     * @param textWords     변경 글에 대는 낱말(공백 없음)
     * @param titlePatterns 정리한 공시 제목에 대는 패턴(공백 없음)
     * @param requiredSectionWords 섹션 경로가 이 낱말 중 하나를 품을 때만 이 규칙을 본다(공백 없음, 비면 제한 없음)
     */
    /** @param label 화면 이름(기획서의 짝 이름, api-spec matchRuleLabel) */
    public record Rule(String key, String label, List<String> sectionWords, List<String> textWords,
            List<String> titlePatterns, List<String> requiredSectionWords) {

        Rule(String key, String label, List<String> sectionWords, List<String> textWords,
                List<String> titlePatterns) {
            this(key, label, sectionWords, textWords, titlePatterns, List.of());
        }

        /** 정리한 섹션 경로·글(공백 없음) 중 하나라도 낱말이 들어 있는지. 섹션 조건이 있으면 그것부터 본다 */
        boolean matchesChange(List<String> compactPaths, String compactText) {
            if (!requiredSectionWords.isEmpty()
                    && compactPaths.stream().noneMatch(path -> containsAny(path, requiredSectionWords))) {
                return false;
            }
            for (String path : compactPaths) {
                if (containsAny(path, sectionWords)) {
                    return true;
                }
            }
            return containsAny(compactText, textWords);
        }

        /** 정리한 제목에 패턴이 들어 있는지 */
        boolean matchesTitle(String title) {
            return containsAny(title, titlePatterns);
        }
    }

    /** 규칙 사전. 순서가 한 쌍에 남길 규칙의 우선순위다 */
    public static final List<Rule> RULES = List.of(
            new Rule("litigation", "소송",
                    List.of("소송"),
                    List.of("소송", "소제기", "판결", "손해배상"),
                    List.of("소송등의제기", "판결", "소송")),
            new Rule("supply-contract", "공급계약",
                    List.of("수주"),
                    List.of("공급계약", "판매계약", "수주"),
                    List.of("단일판매", "공급계약")),
            new Rule("equity-financing", "자본 조달",
                    List.of(),
                    List.of("유상증자", "신주"),
                    List.of("유상증자", "무상증자", "감자")),
            new Rule("debt-financing", "빚 조달",
                    List.of("차입금", "사채"),
                    List.of("전환사채", "신주인수권부사채", "차입"),
                    List.of("전환사채", "신주인수권부사채", "교환사채")),
            new Rule("investment", "투자",
                    List.of("종속회사", "관계회사"),
                    List.of("타법인", "출자", "양수", "유형자산취득", "시설투자", "관계기업"),
                    List.of("타법인주식", "출자증권취득", "유형자산취득", "신규시설투자")),
            new Rule("restructuring", "사업 구조 변경",
                    List.of("사업의내용"),
                    List.of("양수", "양도", "합병", "분할", "중단"),
                    List.of("영업양수", "영업양도", "합병", "회사분할", "영업정지")),
            new Rule("going-concern", "존속 위험",
                    List.of(),
                    List.of("계속기업", "회생", "부도"),
                    List.of("회생절차", "부도", "해산")),
            // 기획서는 재무 수치 변경 쪽이지만 재무 변경 연결은 이번 범위 밖이라 문장의 계정 이름으로 본다.
            // 잠정실적은 재무제표 수치와 같은 실적이라 재무제표 섹션에서만 본다(ADR-0038)
            new Rule("earnings", "실적",
                    List.of(),
                    List.of("매출액", "영업이익", "당기순이익"),
                    List.of("(잠정)실적", "매출액또는손익구조"),
                    List.of("재무제표")));

    /** 관련 수시공시 영역 맨 아래에 늘 보여 주는 고정 문구(ADR-0030) */
    public static final String NOTICE = "같은 기간에 공개된 관련 공시입니다. 변경의 원인을 뜻하지 않습니다.";

    private static final Map<String, Rule> BY_KEY = RULES.stream()
            .collect(Collectors.toUnmodifiableMap(Rule::key, rule -> rule));

    private RelatedDisclosureRules() {
    }

    /** 규칙 키의 화면 이름. 저장된 키가 지금 규칙 사전에 없으면 키를 그대로 준다(규칙 버전을 올리면 다시 계산되므로 드묾) */
    public static String label(String key) {
        Rule rule = BY_KEY.get(key);
        return rule == null ? key : rule.label();
    }

    /** 공시 제목이 걸리는 규칙(RULES 순서) */
    public static List<Rule> titleRules(String reportName) {
        String title = DisclosureGroupRules.title(reportName);
        return RULES.stream().filter(rule -> rule.matchesTitle(title)).toList();
    }

    /** 섹션 경로들과 글이 걸리는 규칙(RULES 순서). 경로·글은 null일 수 있다 */
    public static List<Rule> changeRules(List<String> sectionPaths, String text) {
        List<String> paths = sectionPaths.stream().filter(p -> p != null).map(RelatedDisclosureRules::compact)
                .toList();
        String compactText = text == null ? "" : compact(text);
        return RULES.stream().filter(rule -> rule.matchesChange(paths, compactText)).toList();
    }

    /** 변경 쪽 규칙과 공시 쪽 규칙이 함께 걸린 첫 규칙 */
    public static Optional<Rule> firstCommon(List<Rule> changeRules, List<Rule> titleRules) {
        return RULES.stream().filter(changeRules::contains).filter(titleRules::contains).findFirst();
    }

    /** 앞머리에 정정 꼬리표([기재정정] 등)가 붙은 제목인지 */
    public static boolean isCorrection(String reportName) {
        return reportName != null && CORRECTION_TAG.matcher(reportName).find();
    }

    /** 비고(rm)에 '정'(정정 신고 있음)이 있는지 */
    public static boolean isCorrected(String remark) {
        return remark != null && remark.contains("정");
    }

    /** 비고(rm)에 '철'(철회)이 있는지 */
    public static boolean isWithdrawn(String remark) {
        return remark != null && remark.contains("철");
    }

    private static String compact(String value) {
        return SPACES.matcher(value).replaceAll("");
    }

    private static boolean containsAny(String value, List<String> words) {
        for (String word : words) {
            if (value.contains(word)) {
                return true;
            }
        }
        return false;
    }
}
