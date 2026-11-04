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
import java.util.regex.Pattern;
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
    /** 답 길이 상한. 정리 형식(BRIEF) 1,500자가 가장 길다(docs/api-spec.md format, #581) */
    static final int MAX_ANSWER_CHARS = 1500;
    /** ai-server app/agent/prompt.py TASK_ANSWER. 호출 기록에 task가 없을 때 쓴다 */
    static final String TASK = "agent_answer";

    private static final Logger log = LoggerFactory.getLogger(ChatResults.class);
    /** 근거 ID 모양으로 시작하는 근거 표시(ADR-0048): [T1]·[F1]·[D{접수번호}]·[C{고유번호}]·[{접수번호}#B·S·V{번호}] */
    private static final Pattern EVIDENCE_MARKER = Pattern.compile(
            "\\[\\s*(?:[TF]\\d+|D\\d{14}|C\\d{8}|\\d{14}#[BSV]\\d+)");
    /** 바꾼 답의 근거 번호 표시([1]·[2])와 그 앞의 가로 공백. 게시판 글 초안 본문에서 뺀다(줄바꿈은 둠) */
    private static final Pattern MARKER_NUMBER = Pattern.compile("[ \\t]*\\[\\d+\\]");
    /** 두 칸 이상 이어진 가로 공백(줄바꿈은 문단 나눔이라 건드리지 않음) */
    private static final Pattern HORIZONTAL_SPACES = Pattern.compile("[ \\t]{2,}");

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
            Map<String, String> reportNames, List<Map<String, Object>> checked, List<AskedQuestion> asked,
            boolean lookedUp) {
        AgentStepAiResponse.Final result = response.finalAnswer();
        // 게시판 글 초안은 검토를 통과한 LLM 답으로 본문을 채우므로, 그런 답이 아니면 뺀다
        List<Map<String, Object>> actions = checked.stream()
                .filter(a -> !AgentActions.OPEN_POST_DRAFT.equals(a.get("type"))).toList();
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
        if (ChatStatus.ANSWERED.name().equals(result.status()) && fixedAnswer(response)) {
            // 정해진 요청(이동·저장 확인, #631): ai-server가 LLM 없이 정해진 안내로 답함. 근거 표시가 없다.
            // 안내는 버튼을 가리키므로, 값 확인에서 버튼이 빠졌으면(이 분석에 없는 변경 등) 안내를 내보내지 않는다
            if (actions.isEmpty()) {
                return new ChatMessageResponse(ChatStatus.NOT_FOUND.name(), null, NOT_FOUND, List.of(), List.of(),
                        format, null, null, false, null);
            }
            return new ChatMessageResponse(ChatStatus.ANSWERED.name(), result.answer(), null, List.of(), actions,
                    format, null, null, false, null);
        }
        if (!ChatStatus.ANSWERED.name().equals(result.status())) {
            String reason = result.reviewReason() == null ? NOT_VERIFIED : result.reviewReason();
            return status(ChatStatus.REVIEW_NEEDED, reason);
        }
        AnswerMarkers.Converted converted = AnswerMarkers.convert(result.answer(), evidence.keySet(), Set.of());
        // 글자 수는 ai-server(파이썬 len)와 같게 코드 포인트로 센다(이모지 등 보조 문자를 1자로)
        if (!converted.valid()
                || converted.answer().codePointCount(0, converted.answer().length()) > MAX_ANSWER_CHARS) {
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
        return new ChatMessageResponse(ChatStatus.ANSWERED.name(), converted.answer(), null, citations,
                AgentActions.withPostBody(checked, postBody(converted.answer())), format, result.crossCheck(),
                AskedQuestion.ratedBy(asked, converted.evidenceIds()), true, ai);
    }

    /** 게시판 글 초안 본문: 검토를 통과한 답에서 근거 표시([1])를 빼고 글 본문 길이까지 */
    static String postBody(String answer) {
        String withoutMarkers = MARKER_NUMBER.matcher(answer).replaceAll("");
        String body = HORIZONTAL_SPACES.matcher(withoutMarkers).replaceAll(" ").strip();
        return body.length() <= AgentActions.MAX_POST_BODY ? body : body.substring(0, AgentActions.MAX_POST_BODY);
    }

    /**
     * ai-server가 LLM 없이 만든 정해진 안내인지: 모델·호출 기록이 없고 근거 ID·근거 표시가 없음.
     * 근거 표시는 근거 ID 모양만 본다(목차 제목의 '[첨부]' 같은 대괄호는 근거 표시가 아님).
     * LLM이 만든 답(model 있음)은 근거 표시가 하나 이상 있어야 한다(ADR-0044).
     */
    private static boolean fixedAnswer(AgentStepAiResponse response) {
        AgentStepAiResponse.Final result = response.finalAnswer();
        return response.model() == null && (response.calls() == null || response.calls().isEmpty())
                && (result.evidenceIds() == null || result.evidenceIds().isEmpty())
                && result.answer() != null && !result.answer().isBlank()
                && !EVIDENCE_MARKER.matcher(result.answer()).find();
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
        Evidence.Value v = e.value() == null ? new Evidence.Value(null, null, null, null, null, null, null) : e.value();
        return new Citation(no, e.kind().name(), e.evidenceId(), e.changeId(), e.changeType(), e.side(), e.rceptNo(),
                reportName, e.rceptDt(), e.dartUrl(), e.sectionNo(), e.blockNo(), e.sectionPath(), e.quote(), e.sjDiv(),
                e.accountName(), e.sentence(), gradeOf(e), v.source(), v.label(), v.value(), v.unit(), v.currency(),
                v.corpCode(), v.corpName());
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
