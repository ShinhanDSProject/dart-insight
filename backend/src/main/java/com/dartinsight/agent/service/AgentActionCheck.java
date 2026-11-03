package com.dartinsight.agent.service;

import com.dartinsight.agent.domain.AgentActions;
import com.dartinsight.analysis.service.FinancialChangeQueryService;
import com.dartinsight.analysis.service.SourceDocumentService;
import com.dartinsight.analysis.service.TextChangeQueryService;
import com.dartinsight.common.error.ApiException;
import java.util.ArrayList;
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

    /** 확인을 통과한 액션(받은 순서), 버튼 문구를 붙임 */
    List<Map<String, Object>> valid(Long analysisId, List<Map<String, Object>> actions) {
        List<Map<String, Object>> kept = new ArrayList<>();
        for (Map<String, Object> action : actions == null ? List.<Map<String, Object>>of() : actions) {
            if (action != null && exists(analysisId, action)) {
                kept.add(AgentActions.withLabel(action));
            } else {
                log.warn("이 분석에 없는 값을 가리키는 화면 액션을 뺐습니다: {}", action == null ? null : action.get("type"));
            }
        }
        return kept;
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
                case AgentActions.OPEN_DOCUMENT -> AgentActions.SIDES.contains(action.get("side"))
                        && id(action.get("sectionNo")) != null
                        && sourceDocumentService.section(analysisId, (String) action.get("side"),
                        id(action.get("sectionNo")).intValue()) != null;
                case AgentActions.OPEN_GLOSSARY -> action.get("term") instanceof String term && !term.isBlank();
                default -> true;
            };
        } catch (ApiException e) {
            return false;
        }
    }

    private static Long id(Object value) {
        return value instanceof Integer || value instanceof Long ? ((Number) value).longValue() : null;
    }
}
