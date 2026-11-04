package com.dartinsight.agent.service;

import com.dartinsight.agent.domain.AgentActions;
import com.dartinsight.agent.domain.AskedQuestion;
import com.dartinsight.agent.domain.ComparabilityCheck;
import com.dartinsight.analysis.service.AnalysisResultService;
import com.dartinsight.company.service.CompanyService;
import com.dartinsight.analysis.service.FinancialChangeQueryService;
import com.dartinsight.analysis.service.SourceDocumentService;
import com.dartinsight.analysis.service.SourceDocumentService.SourceSection;
import com.dartinsight.analysis.service.TextChangeQueryService;
import com.dartinsight.common.error.ApiException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * ai-server가 돌려준 화면 액션의 값이 이 분석에 실제로 있는지 확인한다(ADR-0044, docs/api-spec.md final.actions).
 * ai-server는 종류와 형식만 보므로 값 확인은 여기서 한다. 맞지 않는 액션은 빼고 로그를 남긴다.
 */
@Component
@RequiredArgsConstructor
class AgentActionCheck {

    private static final Logger log = LoggerFactory.getLogger(AgentActionCheck.class);

    private final TextChangeQueryService textChangeQueryService;
    private final FinancialChangeQueryService financialChangeQueryService;
    private final SourceDocumentService sourceDocumentService;
    private final AnalysisResultService analysisResultService;
    private final CompanyService companyService;

    /**
     * 확인을 통과한 액션(받은 순서), 버튼 문구를 붙임.
     *
     * @param corpCode  이 분석의 기업(관심 기업 확인은 이 기업만)
     * @param questions 이 채팅에서 근거 질문 Tool이 저장한 질문(답 인용 노트는 이 질문·인용만)
     * @param checks    이 채팅에서 실행한 비교 가능성 검증(분석 요청 확인은 같은 값으로 비교할 수 있었을 때만)
     */
    List<Map<String, Object>> valid(Long analysisId, String corpCode, Map<Long, AskedQuestion> questions,
            List<ComparabilityCheck> checks, List<Map<String, Object>> actions) {
        List<Map<String, Object>> kept = new ArrayList<>();
        for (Map<String, Object> action : actions == null ? List.<Map<String, Object>>of() : actions) {
            Map<String, Object> checked = action == null ? null
                    : checked(analysisId, corpCode, questions, checks, action);
            if (checked != null) {
                kept.add(AgentActions.withLabel(checked));
            } else {
                log.warn("이 분석에 없는 값을 가리키는 화면 액션을 뺐습니다: {}", action == null ? null : action.get("type"));
            }
        }
        return kept;
    }

    /** 확인을 통과하면 화면에 보낼 액션(노트는 분석 ID를 채움), 아니면 null */
    private Map<String, Object> checked(Long analysisId, String corpCode, Map<Long, AskedQuestion> questions,
            List<ComparabilityCheck> checks, Map<String, Object> action) {
        Object type = action.get("type");
        if (AgentActions.CONFIRM_REQUEST_ANALYSIS.equals(type)) {
            return checks.stream().anyMatch(c -> c.allows(action)) ? action : null;
        }
        if (AgentActions.OPEN_POST_DRAFT.equals(type)) {
            return postDraft(analysisId, corpCode, action);
        }
        if (AgentActions.OPEN_COMPANY_COMPARE.equals(type)) {
            return companyCompare(action);
        }
        if (AgentActions.CONFIRM_SAVE_NOTE.equals(type)) {
            try {
                return note(analysisId, questions, action);
            } catch (ApiException e) {
                // 없는 변경(404) 등: 그 액션만 뺀다
                return null;
            }
        }
        if (AgentActions.CONFIRM_FAVORITE.equals(type)) {
            return favorite(corpCode, action);
        }
        return exists(analysisId, action) ? action : null;
    }

    /** 관심 기업 추가: 이 분석의 기업으로 채운다. 다른 기업을 가리키면 뺀다 */
    private static Map<String, Object> favorite(String corpCode, Map<String, Object> action) {
        Object requested = action.get("corpCode");
        if (requested != null && !corpCode.equals(requested)) {
            return null;
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("type", AgentActions.CONFIRM_FAVORITE);
        out.put("corpCode", corpCode);
        return out;
    }

    /** 노트에 담기: 종류마다 담을 대상이 이 분석(또는 이 채팅의 질문)에 있는지. 맞으면 POST /api/notes 본문 */
    private Map<String, Object> note(Long analysisId, Map<Long, AskedQuestion> questions, Map<String, Object> action) {
        if (!(action.get("note") instanceof Map<?, ?> raw)) {
            return null;
        }
        Object kind = raw.get("kind");
        Object memo = raw.get("memo");
        if (memo != null && (!(memo instanceof String text) || text.length() > AgentActions.MAX_MEMO)) {
            return null;
        }
        Map<String, Object> note = new LinkedHashMap<>();
        note.put("kind", kind);
        note.put("analysisId", analysisId);
        boolean found = switch (kind instanceof String name ? name : "") {
            case "FINANCIAL_CHANGE" -> putChange(note, raw) && financialExists(analysisId, id(raw.get("changeId")));
            case "TEXT_CHANGE" -> putChange(note, raw) && textExists(analysisId, id(raw.get("changeId")));
            case "ANSWER_CITATION" -> putCitation(note, questions, raw);
            default -> false;
        };
        if (!found) {
            return null;
        }
        note.put("memo", memo == null || ((String) memo).isBlank() ? null : ((String) memo).strip());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("type", AgentActions.CONFIRM_SAVE_NOTE);
        out.put("note", note);
        return out;
    }

    private static boolean putChange(Map<String, Object> note, Map<?, ?> raw) {
        Long changeId = id(raw.get("changeId"));
        note.put("changeId", changeId);
        return changeId != null;
    }

    private boolean financialExists(Long analysisId, Long changeId) {
        return changeId != null && financialChangeQueryService.changes(analysisId).changes().stream()
                .anyMatch(c -> c.getId().equals(changeId));
    }

    private boolean textExists(Long analysisId, Long changeId) {
        return changeId != null && textChangeQueryService.completedChange(analysisId, changeId) != null;
    }

    /** 답 인용: 이 채팅에서 근거 질문 Tool이 저장한 질문이고 그 답에 있는 인용 번호여야 한다 */
    private static boolean putCitation(Map<String, Object> note, Map<Long, AskedQuestion> questions, Map<?, ?> raw) {
        Long questionId = id(raw.get("questionId"));
        Long citationNo = id(raw.get("citationNo"));
        AskedQuestion question = questionId == null ? null : questions.get(questionId);
        if (question == null || citationNo == null || !question.hasCitation(citationNo)) {
            return false;
        }
        note.put("questionId", questionId);
        note.put("citationNo", citationNo);
        return true;
    }

    private boolean exists(Long analysisId, Map<String, Object> action) {
        Object type = action.get("type");
        if (!(type instanceof String name) || !AgentActions.known(name)) {
            return false;
        }
        try {
            return switch (name) {
                case AgentActions.OPEN_TAB -> AgentActions.TABS.contains(action.get("tab"));
                case AgentActions.OPEN_TEXT_CHANGE -> id(action.get("changeId")) != null
                        && textChangeQueryService.completedChange(analysisId, id(action.get("changeId"))) != null;
                case AgentActions.OPEN_FINANCIAL_CHANGE -> id(action.get("changeId")) != null
                        && financialChangeQueryService.changes(analysisId).changes().stream()
                        .anyMatch(c -> c.getId().equals(id(action.get("changeId"))));
                case AgentActions.OPEN_DOCUMENT -> documentExists(analysisId, action);
                case AgentActions.OPEN_GLOSSARY -> action.get("term") instanceof String term && !term.isBlank();
                case AgentActions.PIN_CHANGE -> textExists(analysisId, id(action.get("changeId")));
                case AgentActions.OPEN_ANALYSIS -> id(action.get("analysisId")) != null
                        && analysisResultService.completed(id(action.get("analysisId"))) != null;
                default -> true;
            };
        } catch (ApiException e) {
            return false;
        }
    }

    /**
     * 게시판 글 초안: 기업은 이 분석의 기업, 인용의 분석은 이 분석으로 채운다. 인용 변경이 이 분석에 없으면 인용만 뺀다.
     * 본문은 검토를 통과한 최종 답으로 ChatResults가 채운다(LLM이 준 본문은 쓰지 않음).
     */
    private Map<String, Object> postDraft(Long analysisId, String corpCode, Map<String, Object> action) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("type", AgentActions.OPEN_POST_DRAFT);
        out.put("corpCode", corpCode);
        if (action.get("quote") instanceof Map<?, ?> quote && quote.get("kind") instanceof String kind
                && AgentActions.QUOTE_KINDS.contains(kind)) {
            Long changeId = id(quote.get("changeId"));
            boolean found;
            try {
                found = "TEXT_CHANGE".equals(kind) ? textExists(analysisId, changeId)
                        : financialExists(analysisId, changeId);
            } catch (ApiException e) {
                found = false;
            }
            if (found) {
                Map<String, Object> kept = new LinkedHashMap<>();
                kept.put("kind", kind);
                kept.put("analysisId", analysisId);
                kept.put("changeId", changeId);
                out.put("quote", kept);
            }
        }
        out.put("body", null);
        return out;
    }

    /** 기업 나란히 보기: 기업 목록에 있는 고유번호만 겹치지 않게 남기고, 2곳 미만이면 뺀다 */
    private Map<String, Object> companyCompare(Map<String, Object> action) {
        if (!(action.get("corpCodes") instanceof List<?> codes)) {
            return null;
        }
        List<String> kept = codes.stream().filter(String.class::isInstance).map(String.class::cast).distinct()
                .filter(code -> companyService.find(code).isPresent()).toList();
        if (kept.size() < 2) {
            return null;
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("type", AgentActions.OPEN_COMPANY_COMPARE);
        out.put("corpCodes", kept);
        return out;
    }

    /** 원문 항목이 있고, 문단 번호가 있으면 그 항목 안의 문단인지 */
    private boolean documentExists(Long analysisId, Map<String, Object> action) {
        Long sectionNo = id(action.get("sectionNo"));
        if (!AgentActions.SIDES.contains(action.get("side")) || sectionNo == null) {
            return false;
        }
        SourceSection section = sourceDocumentService.section(analysisId, (String) action.get("side"),
                sectionNo.intValue());
        Object blockNo = action.get("blockNo");
        if (blockNo == null) {
            return true;
        }
        Long block = id(blockNo);
        return block != null && section.blocks().stream().anyMatch(b -> b.blockNo() == block);
    }

    private static Long id(Object value) {
        return value instanceof Integer || value instanceof Long ? ((Number) value).longValue() : null;
    }
}
