package com.dartinsight.common.error;

import java.util.List;

/**
 * 정해진 에러 코드로 응답할 때 던지는 예외. 처리는 {@link GlobalExceptionHandler}가 한다.
 */
public class ApiException extends RuntimeException {

    private final ErrorCode errorCode;
    private final List<ErrorResponse.FieldError> fieldErrors;
    /** 다시 시도할 수 있을 때까지 남은 초(Retry-After). 없으면 null */
    private final Long retryAfterSeconds;

    public ApiException(ErrorCode errorCode) {
        this(errorCode, errorCode.defaultMessage());
    }

    public ApiException(ErrorCode errorCode, String message) {
        this(errorCode, message, List.of(), null);
    }

    public ApiException(ErrorCode errorCode, String message, Throwable cause) {
        super(message, cause);
        this.errorCode = errorCode;
        this.fieldErrors = List.of();
        this.retryAfterSeconds = null;
    }

    private ApiException(ErrorCode errorCode, String message, List<ErrorResponse.FieldError> fieldErrors,
            Long retryAfterSeconds) {
        super(message);
        this.errorCode = errorCode;
        this.fieldErrors = List.copyOf(fieldErrors);
        this.retryAfterSeconds = retryAfterSeconds;
    }

    /** 한도처럼 정해진 시각이 지나야 다시 되는 실패. 응답에 Retry-After(초)가 붙는다(ADR-0056) */
    public static ApiException retryAfter(ErrorCode errorCode, String message, long seconds) {
        return new ApiException(errorCode, message, List.of(), seconds);
    }

    /** 입력값 하나가 잘못됐을 때(400 COMMON_INVALID_INPUT, errors에 항목 하나). */
    public static ApiException invalidInput(String field, String reason) {
        return new ApiException(ErrorCode.COMMON_INVALID_INPUT, ErrorCode.COMMON_INVALID_INPUT.defaultMessage(),
                List.of(new ErrorResponse.FieldError(field, reason)), null);
    }

    public ErrorCode errorCode() {
        return errorCode;
    }

    public List<ErrorResponse.FieldError> fieldErrors() {
        return fieldErrors;
    }

    public Long retryAfterSeconds() {
        return retryAfterSeconds;
    }
}
