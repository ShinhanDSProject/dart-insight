package com.dartinsight.agent.service;

import com.dartinsight.agent.domain.AgentActions;
import com.dartinsight.agent.domain.AgentStep;
import com.dartinsight.agent.domain.AskedQuestion;
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

    /** 화면이 '확인된 설명 없음' 제목을 붙이므로 그 말을 다시 넣지 않는다(#623) */
    static final String NOT_FOUND = "실행한 기능의 결과에서 관련 자료를 찾지 못했어요.";
    /** 저장 확인 버튼만 돌려주는 답의 정해진 안내(LLM 없음) */
    static final String CONFIRM_ONLY = "아래 버튼을 누르면 저장해요.";
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
     * @param asked    이 채팅에서 근거 질문 Tool이 만든 질문. 최종 답이 인용한 질문만 questionId로 내보낸다
     * @param lookedUp LLM이 고른 Tool을 실행했는지. 조회했는데 못 찾았으면 확인 버튼이 있어도 NOT_FOUND로 둔다
     */
    static ChatMessageResponse finalAnswer(AgentStepAiResponse response, Map<String, Evidence> evidence,
            Map<String, String> reportNames, List<Map<String, Object>> actions, List<AskedQuestion> asked, boolean lookedUp) {
        AgentStepAiResponse.Final result = response.finalAnswer();
        String format = result.format() == null ? AgentStep.FORMAT_CHAT : result.format();
        if (ChatStatus.NOT_FOUND.name().equals(result.status()) && !lookedUp && AgentActions.hasConfirm(actions)) {
            // 저장 확인만 하는 요청(조회 Tool을 부르지 않음): 버튼을 누르면 되므로 '찾지 못함'으로 보이지 않게 한다.
            // 조회·저장을 함께 요청해 조회가 실패했으면 그 실패를 감추지 않는다
            return new ChatMessageResponse(ChatStatus.ANSWERED.name(), CONFIRM_ONLY, null, List.of(), actions, format,
                    null, null, false, null);
        }
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
                format, result.crossCheck(), AskedQuestion.ratedBy(asked, converted.evidenceIds()), true, ai);
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
        String reportName = e.reportName() != null ? e.reportName()
                : e.rceptNo() == null ? null : reportNames.get(e.rceptNo());
        return new Citation(no, e.kind().name(), e.evidenceId(), e.changeId(), e.changeType(), e.side(), e.rceptNo(),
                reportName, e.rceptDt(), e.dartUrl(), e.sectionNo(), e.blockNo(), e.sectionPath(), e.quote(), e.sjDiv(),
                e.accountName(), e.sentence(), gradeOf(e));
    }

    /** 응답의 등급은 설명이 있는 것(STATED·RELATED)만. NONE은 '확인된 설명 없음'이라 등급을 붙이지 않는다 */
    private static String gradeOf(Evidence e) {
        return "STATED".equals(e.grade()) || "RELATED".equals(e.grade()) ? e.grade() : null;
    }

    static LocalDateTime time(String value) {
        try {
            return value == null ? null : LocalDateTime.parse(value);
        } catch (DateTimeParseException e) {
            return null;
        }
    }
}
