package com.dartinsight.aiserver;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;

/**
 * AI 서버 호출 실패. 응답이 없으면 remoteCode가 null이고, AI 서버가 에러 형식으로 답했으면 그 code를 담는다
 * (예: AI_LLM_UNAVAILABLE). 화면에는 {@link ErrorCode#AI_SERVER_UNAVAILABLE}로 보인다.
 */
public class AiServerException extends ApiException {

    private final String remoteCode;

    public AiServerException(String remoteCode, String message, Throwable cause) {
        super(ErrorCode.AI_SERVER_UNAVAILABLE, message, cause);
        this.remoteCode = remoteCode;
    }

    public String remoteCode() {
        return remoteCode;
    }
}
