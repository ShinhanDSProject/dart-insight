package com.dartinsight.agent.domain;

import static com.dartinsight.agent.domain.Schemas.bool;
import static com.dartinsight.agent.domain.Schemas.integer;
import static com.dartinsight.agent.domain.Schemas.object;
import static com.dartinsight.agent.domain.Schemas.oneOf;
import static com.dartinsight.agent.domain.Schemas.properties;
import static com.dartinsight.agent.domain.Schemas.string;

import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 화면 액션(docs/api-spec.md 공개 API의 actions 표). 화면은 이 종류만 실행한다. 버튼 문구(label)는 LLM 문장이 아니라
 * 여기서 종류별로 정한다. 값이 이 분석에 실제로 있는지는 AgentChatService가 확인한다.
 */
public final class AgentActions {

    public static final String OPEN_TAB = "OPEN_TAB";
    public static final String OPEN_TEXT_CHANGE = "OPEN_TEXT_CHANGE";
    public static final String OPEN_FINANCIAL_CHANGE = "OPEN_FINANCIAL_CHANGE";
    public static final String OPEN_DOCUMENT = "OPEN_DOCUMENT";
    public static final String OPEN_GLOSSARY = "OPEN_GLOSSARY";
    public static final String DOWNLOAD_BRIEF = "DOWNLOAD_BRIEF";
    /** 확인 버튼(쓰기). 누르면 화면이 기존 API를 부른다. 채팅 API는 저장하지 않는다(ADR-0044) */
    public static final String CONFIRM_SAVE_NOTE = "CONFIRM_SAVE_NOTE";
    public static final String CONFIRM_FAVORITE = "CONFIRM_FAVORITE";

    /** 노트 항목 종류(POST /api/notes의 kind) */
    public static final List<String> NOTE_KINDS = List.of("FINANCIAL_CHANGE", "TEXT_CHANGE", "ANSWER_CITATION");
    /** 노트 메모 최대 길이(POST /api/notes) */
    public static final int MAX_MEMO = 1000;

    public static final List<String> TABS = List.of("summary", "financial", "text", "source");
    public static final List<String> SIDES = List.of("previous", "current");
    public static final List<String> SORTS = List.of("priority", "document");

    private static final Map<String, String> TAB_LABELS = Map.of("summary", "요약에서 보기", "financial",
            "재무 수치에서 보기", "text", "문장 변화에서 보기", "source", "원문에서 보기");
    private static final Map<String, String> LABELS = Map.of(OPEN_TEXT_CHANGE, "이 변경 보기",
            OPEN_FINANCIAL_CHANGE, "수치 근거 보기", OPEN_DOCUMENT, "원문 열기", OPEN_GLOSSARY, "용어 사전 열기",
            DOWNLOAD_BRIEF, "비교 브리프 내려받기", CONFIRM_SAVE_NOTE, "노트에 담기", CONFIRM_FAVORITE, "관심 기업에 추가");

    /** 종류 → type을 뺀 필드의 스키마(ai-server에 보내는 순서) */
    public static final Map<String, Map<String, Object>> SPECS = specs();

    private AgentActions() {
    }

    private static Map<String, Map<String, Object>> specs() {
        Map<String, Object> filters = object(properties(
                "type", string("문장 변경 유형. ADDED·DELETED·MODIFIED·NUMERIC_UPDATE·MOVED·REVIEW_NEEDED를 쉼표로"),
                "section", string("최상위 섹션 제목"),
                "q", string("찾을 글(2~100자)"),
                "risk", bool("위험 관련 변경만"),
                "sort", oneOf("정렬", SORTS)), List.of());
        Map<String, Map<String, Object>> specs = new LinkedHashMap<>();
        specs.put(OPEN_TAB, object(properties(
                "tab", oneOf("열 탭", TABS),
                "filters", filters), List.of("tab")));
        specs.put(OPEN_TEXT_CHANGE, object(properties("changeId", integer("문장 변경 ID")), List.of("changeId")));
        specs.put(OPEN_FINANCIAL_CHANGE, object(properties("changeId", integer("재무 계정 변화 ID")),
                List.of("changeId")));
        specs.put(OPEN_DOCUMENT, object(properties(
                "side", oneOf("보고서 쪽", SIDES),
                "sectionNo", integer("원문 항목 번호"),
                "blockNo", integer("문단 번호")), List.of("side", "sectionNo")));
        specs.put(OPEN_GLOSSARY, object(properties("term", string("용어")), List.of("term")));
        specs.put(DOWNLOAD_BRIEF, object(properties(), List.of()));
        // 분석 ID는 backend가 채운다(LLM이 정하지 않음)
        specs.put(CONFIRM_SAVE_NOTE, object(properties("note", object(properties(
                "kind", oneOf("FINANCIAL_CHANGE 재무 계정 변화, TEXT_CHANGE 문장 변경, ANSWER_CITATION 근거 질문 답의 인용",
                        NOTE_KINDS),
                "changeId", integer("재무·문장 변경 ID(재무·문장일 때)"),
                "questionId", integer("근거 질문 ID(답 인용일 때)"),
                "citationNo", integer("그 답의 인용 번호(답 인용일 때)"),
                "memo", string("사용자가 남기라고 한 메모(1,000자 이하)")), List.of("kind"))), List.of("note")));
        // 관심 기업은 이 분석의 기업만. 고유번호는 backend가 채운다(ai-server 요청에 고유번호가 없음)
        specs.put(CONFIRM_FAVORITE, object(properties(), List.of()));
        return specs;
    }

    public static boolean known(String type) {
        return type != null && SPECS.containsKey(type);
    }

    /** 저장 확인 액션(노트 담기·관심 기업 추가)이 하나라도 있는지. 확인만 하는 요청을 '찾지 못함'으로 보이지 않게 쓴다(#623) */
    public static boolean hasConfirm(List<Map<String, Object>> actions) {
        return actions.stream().map(a -> a.get("type"))
                .anyMatch(t -> CONFIRM_SAVE_NOTE.equals(t) || CONFIRM_FAVORITE.equals(t));
    }

    /**
     * 저장 확인만 하는 요청인지: 확인 액션이 있고, 실행한 Tool마다 그 결과에 노트에 담을 대상(재무·문장 변경)이
     * 들어 있다(대상을 찾으려고 부른 Tool). 대상이 없는 Tool 결과가 하나라도 있으면 따로 조회한 것으로 본다.
     *
     * @param lookups 실행한 Tool마다 그 결과의 근거 ID
     */
    public static boolean onlySaves(List<Map<String, Object>> actions, List<Set<String>> lookups) {
        if (!hasConfirm(actions)) {
            return false;
        }
        Set<String> targets = noteTargets(actions);
        return lookups.stream().allMatch(ids -> ids.stream().anyMatch(targets::contains));
    }

    /** 노트에 담기 액션이 가리키는 변경의 근거 ID(F{id}·T{id}) */
    private static Set<String> noteTargets(List<Map<String, Object>> actions) {
        Set<String> targets = new HashSet<>();
        for (Map<String, Object> action : actions) {
            if (CONFIRM_SAVE_NOTE.equals(action.get("type")) && action.get("note") instanceof Map<?, ?> note
                    && note.get("changeId") instanceof Number changeId) {
                if ("FINANCIAL_CHANGE".equals(note.get("kind"))) {
                    targets.add(Evidence.financialChangeId(changeId.longValue()));
                } else if ("TEXT_CHANGE".equals(note.get("kind"))) {
                    targets.add(Evidence.textChangeId(changeId.longValue()));
                }
            }
        }
        return targets;
    }

    /** 화면에 보낼 액션: type, label, 그 밖의 필드(받은 순서) */
    public static Map<String, Object> withLabel(Map<String, Object> action) {
        String type = (String) action.get("type");
        String label = OPEN_TAB.equals(type) ? TAB_LABELS.get(action.get("tab")) : LABELS.get(type);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("type", type);
        out.put("label", label);
        action.forEach((key, value) -> {
            if (!"type".equals(key) && value != null) {
                out.put(key, withoutNulls(value));
            }
        });
        return out;
    }

    /** 엄격 구조화 출력이 채운 null(없는 값)을 중첩 필드에서도 뺀다 */
    private static Object withoutNulls(Object value) {
        if (!(value instanceof Map<?, ?> map)) {
            return value;
        }
        Map<String, Object> out = new LinkedHashMap<>();
        map.forEach((key, item) -> {
            if (item != null) {
                out.put(String.valueOf(key), withoutNulls(item));
            }
        });
        return out;
    }
}
