package com.dartinsight.agent.domain;

import static com.dartinsight.agent.domain.Schemas.array;
import static com.dartinsight.agent.domain.Schemas.bool;
import static com.dartinsight.agent.domain.Schemas.integer;
import static com.dartinsight.agent.domain.Schemas.object;
import static com.dartinsight.agent.domain.Schemas.oneOf;
import static com.dartinsight.agent.domain.Schemas.properties;
import static com.dartinsight.agent.domain.Schemas.string;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

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
    /** 분석 찾기·요청과 기록·커뮤니티 액션(#583) */
    public static final String PIN_CHANGE = "PIN_CHANGE";
    public static final String OPEN_POST_DRAFT = "OPEN_POST_DRAFT";
    public static final String OPEN_ANALYSIS = "OPEN_ANALYSIS";
    public static final String OPEN_COMPANY_COMPARE = "OPEN_COMPANY_COMPARE";
    public static final String CONFIRM_REQUEST_ANALYSIS = "CONFIRM_REQUEST_ANALYSIS";
    /** 비교 기준(POST /api/analyses의 basis) */
    public static final List<String> BASES = List.of("YOY", "PREV", "CUSTOM");
    /** 게시판 글 인용 종류(POST /api/companies/{corpCode}/posts의 quote.kind) */
    public static final List<String> QUOTE_KINDS = List.of("FINANCIAL_CHANGE", "TEXT_CHANGE");
    /** 게시판 글 본문 최대 길이(POST /api/companies/{corpCode}/posts) */
    public static final int MAX_POST_BODY = 2000;

    /** 노트 항목 종류(POST /api/notes의 kind) */
    public static final List<String> NOTE_KINDS = List.of("FINANCIAL_CHANGE", "TEXT_CHANGE", "ANSWER_CITATION");
    /** 노트 메모 최대 길이(POST /api/notes) */
    public static final int MAX_MEMO = 1000;

    public static final List<String> TABS = List.of("summary", "financial", "text", "source");
    public static final List<String> SIDES = List.of("previous", "current");
    public static final List<String> SORTS = List.of("priority", "document");

    private static final Map<String, String> TAB_LABELS = Map.of("summary", "요약에서 보기", "financial",
            "재무 수치에서 보기", "text", "전체 변경에서 보기", "source", "원문에서 보기");
    private static final Map<String, String> LABELS = Map.ofEntries(Map.entry(OPEN_TEXT_CHANGE, "이 변경 보기"),
            Map.entry(OPEN_FINANCIAL_CHANGE, "수치 근거 보기"), Map.entry(OPEN_DOCUMENT, "원문 열기"),
            Map.entry(OPEN_GLOSSARY, "용어 사전 열기"), Map.entry(DOWNLOAD_BRIEF, "비교 브리프 내려받기"),
            Map.entry(CONFIRM_SAVE_NOTE, "노트에 담기"), Map.entry(CONFIRM_FAVORITE, "관심 기업에 추가"),
            Map.entry(PIN_CHANGE, "이 변경 고정"), Map.entry(OPEN_POST_DRAFT, "게시판 글 초안 열기"),
            Map.entry(OPEN_ANALYSIS, "이 분석 열기"), Map.entry(OPEN_COMPANY_COMPARE, "기업 나란히 보기"),
            Map.entry(CONFIRM_REQUEST_ANALYSIS, "이 비교로 분석 요청"));

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
        specs.put(PIN_CHANGE, object(properties("changeId", integer("고정할 문장 변경 ID")), List.of("changeId")));
        // 기업·본문·분석 ID는 backend가 채운다(본문은 검토를 통과한 최종 답)
        specs.put(OPEN_POST_DRAFT, object(properties("quote", object(properties(
                "kind", oneOf("붙일 변경점 종류", QUOTE_KINDS),
                "changeId", integer("이 분석의 재무 계정 변화 또는 문장 변경 ID")), List.of("kind", "changeId"))),
                List.of()));
        specs.put(OPEN_ANALYSIS, object(properties("analysisId", integer("완료된 분석 ID(find_analyses 결과)")),
                List.of("analysisId")));
        specs.put(OPEN_COMPANY_COMPARE, object(properties("corpCodes", array("나란히 볼 기업 고유번호(2개 이상)",
                string("기업 고유번호"))), List.of("corpCodes")));
        specs.put(CONFIRM_REQUEST_ANALYSIS, object(properties(
                "corpCode", string("기업 고유번호"),
                "previousRceptNo", string("이전 보고서 접수번호"),
                "currentRceptNo", string("현재 보고서 접수번호"),
                "basis", oneOf("비교 기준", BASES)), List.of("corpCode", "previousRceptNo", "currentRceptNo", "basis")));
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

    /** 게시판 글 초안 액션에 본문을 채운 목록(나머지 액션은 그대로) */
    public static List<Map<String, Object>> withPostBody(List<Map<String, Object>> actions, String body) {
        return actions.stream().map(action -> {
            if (!OPEN_POST_DRAFT.equals(action.get("type"))) {
                return action;
            }
            Map<String, Object> out = new LinkedHashMap<>(action);
            out.put("body", body);
            return out;
        }).toList();
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
