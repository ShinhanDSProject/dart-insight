package com.dartinsight.agent.dto;

import java.util.List;

/**
 * 채팅 요청(docs/api-spec.md POST /api/analyses/{analysisId}/chat-messages). 검사는 AgentChatService.
 *
 * @param message 앞뒤 공백을 뺀 2~500자
 * @param history 최근 대화, 최대 6개(오래된 것부터)
 * @param context 지금 보는 화면. 없으면 null
 */
public record ChatMessageRequest(String message, List<Turn> history, Context context) {

    /** @param role user, assistant */
    public record Turn(String role, String text) {
    }

    /**
     * @param tab               summary, financial, text, source
     * @param textChangeId      고른 문장 변경
     * @param financialChangeId 고른 재무 계정 변화
     * @param side              원문 뷰어에서 보는 쪽(previous, current)
     * @param sectionNo         원문 뷰어에서 보는 항목
     */
    public record Context(String tab, Long textChangeId, Long financialChangeId, String side, Integer sectionNo) {
    }
}
