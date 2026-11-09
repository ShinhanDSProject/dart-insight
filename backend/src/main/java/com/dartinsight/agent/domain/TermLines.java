package com.dartinsight.agent.domain;

import com.dartinsight.glossary.domain.GlossaryCompanyValue;
import com.dartinsight.glossary.domain.GlossaryLevel;
import com.dartinsight.glossary.domain.GlossaryTerm;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 채팅 Tool lookup_terms의 결과 줄(ADR-0061). 카드는 근거 G{키}로 보내고, 줄 글에는 카드 칸을 모두 넣어
 * ai-server 검토 노드의 숫자 검사가 예시 속 숫자도 확인할 수 있게 한다. 카드가 없으면 근거 없는 줄로
 * '등록된 용어가 없어요'와 비슷한 카드만 알린다(정의를 만들지 않음).
 */
public final class TermLines {

    private TermLines() {
    }

    /**
     * 찾은 카드 한 줄.
     *
     * @param names 내보낼 수 있는 카드 키 → 용어(관련 용어 이름을 붙임)
     */
    public static ToolLine card(GlossaryTerm term, Map<String, String> names) {
        Evidence evidence = Evidence.glossary(new Evidence.Term(term.key(), term.term(), term.definition(),
                term.sources().stream().map(s -> new Evidence.Source(s.title(), s.url())).toList()));
        List<String> parts = new ArrayList<>();
        parts.add("[용어 카드 " + term.term() + ", " + levelLabel(term.level()) + ", 키 " + term.key() + "] 한 줄 뜻: "
                + term.definition());
        if (term.example() != null) {
            parts.add("쉬운 예시(가정한 예, 이 회사의 값이 아님): " + term.example());
        }
        if (term.whereToCheck() != null) {
            parts.add("확인할 곳: " + term.whereToCheck());
        }
        if (term.noJudgment() != null) {
            parts.add("판단하지 않음: " + term.noJudgment());
        }
        if (!term.aliases().isEmpty()) {
            parts.add("별칭: " + String.join(", ", term.aliases()));
        }
        List<String> related = term.related().stream().filter(names::containsKey)
                .map(key -> names.get(key) + "(" + key + ")").toList();
        if (!related.isEmpty()) {
            parts.add("관련 용어: " + String.join(", ", related));
        }
        String companyValue = companyValue(term.companyValue());
        if (companyValue != null) {
            parts.add("이 회사 값을 찾을 곳: " + companyValue);
        }
        parts.add("출처: " + String.join(", ", term.sources().stream().map(s -> s.title()).toList()));
        return new ToolLine(evidence, String.join(" / ", parts));
    }

    /**
     * 카드가 없는 용어 한 줄(근거 없음). 비슷한 카드가 있으면 그 용어와 키를 붙인다.
     */
    public static ToolLine notFound(String query, List<GlossaryTerm> similar) {
        String text = "[용어 카드 없음] '" + query + "'는 등록된 용어가 없어요.";
        if (!similar.isEmpty()) {
            text += " 비슷한 카드: " + String.join(", ", similar.stream()
                    .map(t -> t.term() + "(" + t.key() + ")").toList());
        }
        return new ToolLine(null, text);
    }

    private static String levelLabel(GlossaryLevel level) {
        return level == GlossaryLevel.BASIC ? "기초 카드" : "핵심 카드";
    }

    private static String companyValue(GlossaryCompanyValue value) {
        if (value == null) {
            return null;
        }
        List<String> places = new ArrayList<>();
        if (value.checkpoint() != null) {
            places.add("체크 포인트 " + value.checkpoint() + "(get_checkpoints, 최근 사업보고서 기준)");
        }
        if (!value.accounts().isEmpty()) {
            places.add("재무 계정 " + String.join("·", value.accounts()) + "(get_financial_changes, 이 분석의 두 보고서)");
        }
        return places.isEmpty() ? null : String.join(", ", places);
    }
}
