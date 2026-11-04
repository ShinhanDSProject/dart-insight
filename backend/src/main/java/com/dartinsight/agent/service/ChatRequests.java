package com.dartinsight.agent.service;

import com.dartinsight.agent.domain.AgentActions;
import com.dartinsight.agent.dto.ChatMessageRequest;
import com.dartinsight.agent.dto.ChatMessageRequest.Context;
import com.dartinsight.agent.dto.ChatMessageRequest.Turn;
import com.dartinsight.common.error.ApiException;
import java.util.List;
import java.util.Set;

/** 채팅 요청 검사(docs/api-spec.md). 틀리면 400 COMMON_INVALID_INPUT과 errors[field] */
final class ChatRequests {

    static final int MIN_MESSAGE = 2;
    static final int MAX_MESSAGE = 500;
    static final int MAX_HISTORY = 6;
    /** 대화 한 턴 상한. 답 상한(정리 형식 1,500자)과 같다 */
    static final int MAX_TURN = 1500;
    private static final Set<String> ROLES = Set.of("user", "assistant");

    private ChatRequests() {
    }

    /** 앞뒤 공백을 뺀 메시지와 검사한 대화·화면 맥락 */
    record Checked(String message, List<Turn> history, Context context) {
    }

    static Checked check(ChatMessageRequest request) {
        String message = request == null || request.message() == null ? "" : request.message().strip();
        if (message.length() < MIN_MESSAGE || message.length() > MAX_MESSAGE) {
            throw ApiException.invalidInput("message", MIN_MESSAGE + "~" + MAX_MESSAGE + "자로 입력해 주세요.");
        }
        List<Turn> history = request.history() == null ? List.of() : request.history();
        if (history.size() > MAX_HISTORY) {
            throw ApiException.invalidInput("history", "최근 " + MAX_HISTORY + "개까지 보낼 수 있어요.");
        }
        for (int i = 0; i < history.size(); i++) {
            Turn turn = history.get(i);
            if (turn == null || !ROLES.contains(turn.role())) {
                throw ApiException.invalidInput("history[" + i + "].role", "허용 값: user, assistant");
            }
            if (turn.text() == null || turn.text().length() > MAX_TURN) {
                throw ApiException.invalidInput("history[" + i + "].text", MAX_TURN + "자 이하로 보내 주세요.");
            }
        }
        Context context = request.context();
        if (context != null && context.tab() != null && !AgentActions.TABS.contains(context.tab())) {
            throw ApiException.invalidInput("context.tab", "허용 값: " + String.join(", ", AgentActions.TABS));
        }
        if (context != null && context.side() != null && !AgentActions.SIDES.contains(context.side())) {
            throw ApiException.invalidInput("context.side", "허용 값: " + String.join(", ", AgentActions.SIDES));
        }
        return new Checked(message, history, context);
    }
}
