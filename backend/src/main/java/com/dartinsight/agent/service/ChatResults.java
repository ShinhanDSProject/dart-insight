package com.dartinsight.agent.service;

import com.dartinsight.agent.domain.AgentStep;
import com.dartinsight.agent.domain.ChatStatus;
import com.dartinsight.agent.domain.Evidence;
import com.dartinsight.agent.dto.AgentStepAiResponse;
import com.dartinsight.agent.dto.ChatMessageResponse;
import com.dartinsight.agent.dto.ChatMessageResponse.Citation;
import com.dartinsight.question.domain.AnswerMarkers;
import com.dartinsight.summary.domain.LlmCallRow;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** AI 서버의 최종 답을 채팅 응답으로 바꾼다. 근거 ID는 이 채팅에서 backend가 만든 근거 표로 다시 확인한다(ADR-0044) */
final class ChatResults {

    static final String NOT_FOUND = "확인된 설명 없음: 실행한 기능의 결과에서 관련 자료를 찾지 못했어요.";
    static final String OUT_OF_SCOPE = "매수·매도, 목표주가, 주가 전망 같은 투자 판단에는 답하지 않아요. "
            + "공시에 적힌 내용을 물어봐 주세요.";
    static final String INCOMPLETE = "요청을 끝내지 못했어요. 범위를 좁혀 다시 보내 주세요.";
    static final String NOT_VERIFIED = "답의 근거를 확인하지 못했어요.";
    static final int MAX_ANSWER_CHARS = 1000;
    /** ai-server app/agent/prompt.py TASK_ANSWER. 호출 기록에 task가 없을 때 쓴다 */
    static final String TASK = "agent_answer";

    private static final Logger log = LoggerFactory.getLogger(ChatResults.class);

    private ChatResults() {
    }

    static ChatMessageResponse status(ChatStatus status, String message) {
        return new ChatMessageResponse(status.name(), null, message, List.of(), List.of(), AgentStep.FORMAT_CHAT,
                null, null, false, null);
    }

    /**
     * @param evidence 이 채팅에서 실행한 Tool 결과의 근거 ID → 위치
     * @param actions  값 확인을 통과한 화면 액션
     */
    static ChatMessageResponse finalAnswer(AgentStepAiResponse response, Map<String, Evidence> evidence,
            Map<String, String> reportNames, List<Map<String, Object>> actions) {
        AgentStepAiResponse.Final result = response.finalAnswer();
        String format = result.format() == null ? AgentStep.FORMAT_CHAT : result.format();
        if (ChatStatus.NOT_FOUND.name().equals(result.status())) {
            return new ChatMessageResponse(ChatStatus.NOT_FOUND.name(), null, NOT_FOUND, List.of(), actions, format,
                    null, null, false, null);
        }
        if (!ChatStatus.ANSWERED.name().equals(result.status())) {
            String reason = result.reviewReason() == null ? NOT_VERIFIED : result.reviewReason();
            return status(ChatStatus.REVIEW_NEEDED, reason);
        }
        AnswerMarkers.Converted converted = AnswerMarkers.convert(result.answer(), evidence.keySet(), Set.of());
        if (!converted.valid() || converted.answer().length() > MAX_ANSWER_CHARS) {
            // ai-server가 이미 Tool 결과와 대조했으므로 여기서 걸리면 오류다(ADR-0044)
            log.error("에이전트 답의 근거 ID가 이 채팅의 Tool 결과에 없어 검토 필요로 끝냅니다");
            return status(ChatStatus.REVIEW_NEEDED, NOT_VERIFIED);
        }
        List<Citation> citations = new ArrayList<>();
        for (String id : converted.evidenceIds()) {
            citations.add(citation(citations.size() + 1, evidence.get(id), reportNames));
        }
        ChatMessageResponse.Ai ai = new ChatMessageResponse.Ai(response.model(), response.promptVersion(),
                time(response.generatedAt()));
        return new ChatMessageResponse(ChatStatus.ANSWERED.name(), converted.answer(), null, citations, actions,
                format, result.crossCheck(), null, true, ai);
    }

    static List<LlmCallRow> calls(AgentStepAiResponse response, String traceId) {
        if (response == null || response.calls() == null) {
            return List.of();
        }
        return response.calls().stream().map(c -> new LlmCallRow(c.task() == null ? TASK : c.task(), c.provider(),
                c.model(), c.promptVersion(), time(c.calledAt()), c.traceId() == null ? traceId : c.traceId(),
                c.inputTokens(), c.outputTokens(), c.latencyMs() == null ? 0 : c.latencyMs(),
                c.attempt() == null ? 1 : c.attempt(), c.outcome(), c.error())).toList();
    }

    private static Citation citation(int no, Evidence e, Map<String, String> reportNames) {
        return new Citation(no, e.kind().name(), e.evidenceId(), e.changeId(), e.changeType(), e.side(), e.rceptNo(),
                e.rceptNo() == null ? null : reportNames.get(e.rceptNo()), e.sectionNo(), e.blockNo(), e.sectionPath(),
                e.quote(), e.sjDiv(), e.accountName(), e.sentence(), null);
    }

    static LocalDateTime time(String value) {
        try {
            return value == null ? null : LocalDateTime.parse(value);
        } catch (DateTimeParseException e) {
            return null;
        }
    }
}
