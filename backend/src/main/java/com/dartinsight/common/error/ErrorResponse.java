package com.dartinsight.common.error;

import java.util.List;

/**
 * 모든 에러 응답의 본문. Spring Boot와 FastAPI가 같은 모양을 쓴다(개발 기준 6장).
 *
 * @param errors 입력값 검증 실패일 때만 채우고, 그 밖에는 빈 목록
 */
public record ErrorResponse(String code, String message, String traceId, List<FieldError> errors) {

    public record FieldError(String field, String reason) {
    }

    public static ErrorResponse of(ErrorCode code, String message, String traceId) {
        return new ErrorResponse(code.name(), message, traceId, List.of());
    }

    public static ErrorResponse of(ErrorCode code, String message, String traceId, List<FieldError> errors) {
        return new ErrorResponse(code.name(), message, traceId, List.copyOf(errors));
    }
}
