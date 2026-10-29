package com.dartinsight.aiserver.client;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;

/**
 * AI 서버 호출 실패. 응답이 없으면 remoteCode가 null이고, AI 서버가 에러 형식으로 답했으면 그 code를 담는다
 * (예: AI_LLM_UNAVAILABLE). 화면에는 {@link ErrorCode#AI_SERVER_UNAVAILABLE}로 보인다.
 * 에러 응답에 그때까지의 LLM 호출 기록(헤더 X-Llm-Calls, ADR-0042)이 있었으면 풀어 둔 JSON 배열 글을 담는다.
 */
public class AiServerException extends ApiException {

    private final String remoteCode;
    private final String llmCallsJson;

    public AiServerException(String remoteCode, String message, Throwable cause) {
        this(remoteCode, message, cause, null);
    }

    public AiServerException(String remoteCode, String message, Throwable cause, String llmCallsJson) {
        super(ErrorCode.AI_SERVER_UNAVAILABLE, message, cause);
        this.remoteCode = remoteCode;
        this.llmCallsJson = llmCallsJson;
    }

    public String remoteCode() {
        return remoteCode;
    }

    /** 에러 응답 헤더 X-Llm-Calls를 base64url에서 푼 JSON 배열 글. 헤더가 없거나 풀 수 없었으면 null */
    public String llmCallsJson() {
        return llmCallsJson;
    }
}
