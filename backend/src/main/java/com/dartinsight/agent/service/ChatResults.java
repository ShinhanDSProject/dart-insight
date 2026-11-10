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
    /**
     * 근거 ID 모양으로 시작하는 근거 표시(ADR-0048·0061): [T1]·[F1]·[D{접수번호}]·[C{고유번호}]·[{접수번호}#B·S·V{번호}]·
     * [G{카드 키}](키는 영문 소문자로 시작하는 카멜 표기)
     */
    private static final Pattern EVIDENCE_MARKER = Pattern.compile(
            "\\[\\s*(?:[TF]\\d+|D\\d{14}|C\\d{8}|\\d{14}#[BSV]\\d+|G[a-z][A-Za-z0-9]*)");
    /** 바꾼 답의 근거 번호 표시([1]·[2])와 그 앞의 가로 공백. 게시판 글 초안 본문에서 뺀다(줄바꿈은 둠) */
    private static final Pattern MARKER_NUMBER = Pattern.compile("[ \\t]*\\[\\d+\\]");
    /** 두 칸 이상 이어진 가로 공백(줄바꿈은 문단 나눔이라 건드리지 않음) */
    private static final Pattern HORIZONTAL_SPACES = Pattern.compile("[ \\t]{2,}");

    private ChatResults() {
    }

    static ChatMessageResponse status(ChatStatus status, String message) {
        return new ChatMessageResponse(status.name(), null, message, List.of(), List.of(), AgentStep.FORMAT_CHAT,
                null, null, false, null, false);
    }

    /**
     * @param evidence 이 채팅에서 실행한 Tool 결과의 근거 ID → 위치
     * @param actions  값 확인을 통과한 화면 액션
     * @param asked    이 채팅에서 근거 질문 Tool이 만든 질문. 최종 답이 인용한 질문만 questionId로 내보낸다
     * @param lookedUp LLM이 고른 Tool을 실행했는지. 조회했는데 못 찾았으면 확인 버튼이 있어도 NOT_FOUND로 둔다
     * @param termMissing 이 채팅에서 용어 찾기가 카드가 없는 용어를 돌려줬는지(ADR-0061). 그 용어 안내는 버튼이
     *                    값 확인에서 모두 빠져도 뜻이 통하므로 NOT_FOUND로 바꾸지 않는다
     */
    static ChatMessageResponse finalAnswer(AgentStepAiResponse response, Map<String, Evidence> evidence,
            Map<String, String> reportNames, List<Map<String, Object>> checked, List<AskedQuestion> asked,
            boolean lookedUp, boolean termMissing) {
        AgentStepAiResponse.Final result = response.finalAnswer();
        // 게시판 글 초안은 검토를 통과한 LLM 답으로 본문을 채우므로, 그런 답이 아니면 뺀다
        List<Map<String, Object>> actions = checked.stream()
                .filter(a -> !AgentActions.OPEN_POST_DRAFT.equals(a.get("type"))).toList();
        String format = result.format() == null ? AgentStep.FORMAT_CHAT : result.format();
        if (ChatStatus.NOT_FOUND.name().equals(result.status()) && !lookedUp && AgentActions.hasConfirm(actions)) {
            // 저장 확인만 하는 요청(조회 Tool을 부르지 않음): 버튼을 누르면 되므로 '찾지 못함'으로 보이지 않게 한다.
            // 조회·저장을 함께 요청해 조회가 실패했으면 그 실패를 감추지 않는다
            return new ChatMessageResponse(ChatStatus.ANSWERED.name(), CONFIRM_ONLY, null, List.of(), actions, format,
                    null, null, false, null, false);
        }
        if (ChatStatus.NOT_FOUND.name().equals(result.status())) {
            return new ChatMessageResponse(ChatStatus.NOT_FOUND.name(), null, NOT_FOUND, List.of(), actions, format,
                    result.crossCheck(), null, false, null, false);
        }
        if (ChatStatus.ANSWERED.name().equals(result.status()) && Boolean.TRUE.equals(result.generalExplanation())) {
            return generalExplanation(response, actions, format, termMissing);
        }
        if (ChatStatus.ANSWERED.name().equals(result.status()) && fixedAnswer(response)) {
            // 정해진 요청(이동·저장 확인, #631): ai-server가 LLM 없이 정해진 안내로 답함. 근거 표시가 없다.
            // 안내는 버튼을 가리키므로, 값 확인에서 버튼이 빠졌으면(이 분석에 없는 변경 등) 안내를 내보내지 않는다.
            // 예외로 카드가 없는 용어의 안내('등록된 카드가 없고 보고서에서도 찾지 못함')는 버튼 없이도 뜻이 통한다
            if (actions.isEmpty() && !termMissing) {
                return new ChatMessageResponse(ChatStatus.NOT_FOUND.name(), null, NOT_FOUND, List.of(), List.of(),
                        format, null, null, false, null, false);
            }
            return new ChatMessageResponse(ChatStatus.ANSWERED.name(), result.answer(), null, List.of(), actions,
                    format, null, null, false, null, false);
        }
        if (!ChatStatus.ANSWERED.name().equals(result.status())) {
            String reason = result.reviewReason() == null ? NOT_VERIFIED : result.reviewReason();
            return reviewNeeded(reason, result.crossCheck());
        }
        AnswerMarkers.Converted converted = AnswerMarkers.convert(result.answer(), evidence.keySet(), Set.of());
        // 글자 수는 ai-server(파이썬 len)와 같게 코드 포인트로 센다(이모지 등 보조 문자를 1자로)
        if (!converted.valid()
                || converted.answer().codePointCount(0, converted.answer().length()) > MAX_ANSWER_CHARS) {
            // ai-server가 이미 Tool 결과와 대조했으므로 여기서 걸리면 오류다(ADR-0044)
            log.error("에이전트 답의 근거 ID가 이 채팅의 Tool 결과에 없어 검토 필요로 끝냅니다");
            return reviewNeeded(NOT_VERIFIED, result.crossCheck());
        }
        List<Citation> citations = new ArrayList<>();
        for (String id : converted.evidenceIds()) {
            citations.add(citation(citations.size() + 1, evidence.get(id), reportNames));
        }
        ChatMessageResponse.Ai ai = new ChatMessageResponse.Ai(response.model(), response.promptVersion(),
                time(response.generatedAt()));
        return new ChatMessageResponse(ChatStatus.ANSWERED.name(), converted.answer(), null, citations,
                AgentActions.withPostBody(checked, postBody(converted.answer())), format, result.crossCheck(),
                AskedQuestion.ratedBy(asked, converted.evidenceIds()), true, ai, false);
    }

    /**
     * 카드도 보고서 설명도 없는 용어의 AI 일반 설명(ADR-0064). 근거 표시가 없는 것이 정상이라 근거 재확인을 하지 않는다.
     * 이 채팅에서 용어 찾기가 카드 없는 용어를 돌려줬을 때만 받아들이고, 근거 표시가 섞였거나 그 밖이면 검토 필요로 끝낸다.
     */
    private static ChatMessageResponse generalExplanation(AgentStepAiResponse response,
            List<Map<String, Object>> actions, String format, boolean termMissing) {
        AgentStepAiResponse.Final result = response.finalAnswer();
        boolean marked = result.answer() == null || EVIDENCE_MARKER.matcher(result.answer()).find()
                || (result.evidenceIds() != null && !result.evidenceIds().isEmpty());
        if (!termMissing || marked || response.model() == null) {
            log.error("용어 일반 설명이 받아들일 조건(카드 없는 용어 찾기, 근거 표시 없음, 모델 기록)에 맞지 않아 검토 필요로 끝냅니다");
            return reviewNeeded(NOT_VERIFIED, null);
        }
        ChatMessageResponse.Ai ai = new ChatMessageResponse.Ai(response.model(), response.promptVersion(),
                time(response.generatedAt()));
        return new ChatMessageResponse(ChatStatus.ANSWERED.name(), result.answer(), null, List.of(), actions, format,
                null, null, true, ai, true);
    }

    /** 검토 필요. 답은 내보내지 않지만 교차 검증 결과는 코드가 정한 값이라 그대로 둔다(#581) */
    private static ChatMessageResponse reviewNeeded(String reason, Object crossCheck) {
        return new ChatMessageResponse(ChatStatus.REVIEW_NEEDED.name(), null, reason, List.of(), List.of(),
                AgentStep.FORMAT_CHAT, crossCheck, null, false, null, false);
    }

    /** 게시판 글 초안 본문: 검토를 통과한 답에서 근거 표시([1])를 빼고 글 본문 길이까지 */
    static String postBody(String answer) {
        String withoutMarkers = MARKER_NUMBER.matcher(answer).replaceAll("");
        String body = HORIZONTAL_SPACES.matcher(withoutMarkers).replaceAll(" ").strip();
        return body.length() <= AgentActions.MAX_POST_BODY ? body : body.substring(0, AgentActions.MAX_POST_BODY);
    }

    /**
     * ai-server가 LLM 없이 만든 정해진 안내인지: 모델이 없고 근거 ID·근거 표시가 없음.
     * 호출 기록은 있을 수 있다(용어 일반 설명을 시도했다가 실패해 정해진 안내로 끝난 경우, ADR-0064).
     * 근거 표시는 근거 ID 모양만 본다(목차 제목의 '[첨부]' 같은 대괄호는 근거 표시가 아님).
     * LLM이 만든 답(model 있음)은 근거 표시가 하나 이상 있어야 한다(ADR-0044).
     */
    private static boolean fixedAnswer(AgentStepAiResponse response) {
        AgentStepAiResponse.Final result = response.finalAnswer();
        return response.model() == null
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
                c.attempt() == null ? 1 : c.attempt(), c.outcome(), c.error(), c.cachedInputTokens(),
                c.reasoningTokens())).toList();
    }

    private static Citation citation(int no, Evidence e, Map<String, String> reportNames) {
        String reportName = e.reportName() != null ? e.reportName()
                : e.rceptNo() == null ? null : reportNames.get(e.rceptNo());
        Evidence.Value v = e.value() == null ? new Evidence.Value(null, null, null, null, null, null, null) : e.value();
        Evidence.Term t = e.term();
        return new Citation(no, e.kind().name(), e.evidenceId(), e.changeId(), e.changeType(), e.side(), e.rceptNo(),
                reportName, e.rceptDt(), e.dartUrl(), e.sectionNo(), e.blockNo(), e.sectionPath(), e.quote(), e.sjDiv(),
                e.accountName(), e.sentence(), gradeOf(e), v.source(), v.label(), v.value(), v.unit(), v.currency(),
                v.corpCode(), v.corpName(), t == null ? null : t.key(), t == null ? null : t.term(),
                t == null ? null : t.definition(), t == null ? null : sources(t));
    }

    private static List<ChatMessageResponse.Source> sources(Evidence.Term term) {
        return term.sources().stream().map(s -> new ChatMessageResponse.Source(s.title(), s.url())).toList();
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
