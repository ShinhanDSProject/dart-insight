package com.dartinsight.question.service;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.question.dto.AnswerAiResponse;
import com.dartinsight.summary.domain.LlmCallRow;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;

/**
 * 분석 질문(QuestionService)과 기업 질문(CompanyQuestionService)이 함께 쓰는 질문 검사·AI 서버 답 변환(ADR-0029).
 */
final class AnswerResults {

    static final int MIN_LENGTH = 2;
    static final int MAX_LENGTH = 200;
    static final int HISTORY_SIZE = 20;
    static final int QUOTE_CHARS = 160;
    static final int MAX_ANSWER_CHARS = 1000;
    /** ai-server app/answer/prompt.py TASK. 호출 기록에 task가 없을 때 쓴다 */
    static final String TASK = "answer";
    static final String BAD_EVIDENCE = "답의 근거 표시가 보낸 원문 위치·사실이 아니라 쓰지 않았어요.";
    static final String NOT_VERIFIED = "근거를 확인하지 못했어요.";
    static final String UNKNOWN_STATUS = "AI 서버가 알 수 없는 상태로 답했어요.";

    private AnswerResults() {
    }

    /** 앞뒤 공백을 뺀 2~200자 질문. 아니면 400 errors[question] */
    static String validate(String rawQuestion) {
        String question = rawQuestion == null ? "" : rawQuestion.strip();
        if (question.isEmpty()) {
            throw ApiException.invalidInput("question", "질문을 입력해 주세요.");
        }
        if (question.length() < MIN_LENGTH || question.length() > MAX_LENGTH) {
            throw ApiException.invalidInput("question", MIN_LENGTH + "~" + MAX_LENGTH + "자로 입력해 주세요.");
        }
        return question;
    }

    static String quote(String text) {
        return text == null ? null : text.length() <= QUOTE_CHARS ? text : text.substring(0, QUOTE_CHARS);
    }

    static LlmCallRow call(AnswerAiResponse.Call call, String traceId) {
        return new LlmCallRow(call.task() == null ? TASK : call.task(), call.provider(), call.model(),
                call.promptVersion(), time(call.calledAt()), call.traceId() == null ? traceId : call.traceId(),
                call.inputTokens(), call.outputTokens(), call.latencyMs() == null ? 0 : call.latencyMs(),
                call.attempt() == null ? 1 : call.attempt(), call.outcome(), call.error());
    }

    static LocalDateTime time(String value) {
        try {
            return value == null ? null : LocalDateTime.parse(value);
        } catch (DateTimeParseException e) {
            return null;
        }
    }
}
