package com.dartinsight.common.error;

import java.util.List;

/**
 * 정해진 에러 코드로 응답할 때 던지는 예외. 처리는 {@link GlobalExceptionHandler}가 한다.
 */
public class ApiException extends RuntimeException {

    private final ErrorCode errorCode;
    private final List<ErrorResponse.FieldError> fieldErrors;

    public ApiException(ErrorCode errorCode) {
        this(errorCode, errorCode.defaultMessage());
    }

    public ApiException(ErrorCode errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
        this.fieldErrors = List.of();
    }

    public ApiException(ErrorCode errorCode, String message, Throwable cause) {
        super(message, cause);
        this.errorCode = errorCode;
        this.fieldErrors = List.of();
    }

    private ApiException(ErrorCode errorCode, String message, List<ErrorResponse.FieldError> fieldErrors) {
        super(message);
        this.errorCode = errorCode;
        this.fieldErrors = List.copyOf(fieldErrors);
    }

    /** 입력값 하나가 잘못됐을 때(400 COMMON_INVALID_INPUT, errors에 항목 하나). */
    public static ApiException invalidInput(String field, String reason) {
        return new ApiException(ErrorCode.COMMON_INVALID_INPUT, ErrorCode.COMMON_INVALID_INPUT.defaultMessage(),
                List.of(new ErrorResponse.FieldError(field, reason)));
    }

    public ErrorCode errorCode() {
        return errorCode;
    }

    public List<ErrorResponse.FieldError> fieldErrors() {
        return fieldErrors;
    }
}
