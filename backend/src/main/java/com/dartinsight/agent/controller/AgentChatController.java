package com.dartinsight.agent.controller;

import com.dartinsight.agent.dto.ChatMessageRequest;
import com.dartinsight.agent.dto.ChatMessageResponse;
import com.dartinsight.agent.service.AgentChatService;
import com.dartinsight.common.web.ApiPaths;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * AI 에이전트 채팅(ADR-0044). 화면 W-03 채팅 패널. 동기 호출이고 대화는 저장하지 않는다(화면이 최근 대화를 보냄).
 * 답의 [1]은 citations[].no다. 쓰기는 하지 않고 확인 액션으로만 돌려준다.
 */
@RestController
@RequestMapping(ApiPaths.ANALYSIS_CHAT_MESSAGES)
@RequiredArgsConstructor
public class AgentChatController {

    private final AgentChatService agentChatService;

    @PostMapping
    public ChatMessageResponse chat(@PathVariable Long analysisId, @RequestBody ChatMessageRequest request) {
        return agentChatService.chat(analysisId, request);
    }
}
