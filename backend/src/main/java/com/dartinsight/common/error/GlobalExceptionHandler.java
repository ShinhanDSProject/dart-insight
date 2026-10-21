package com.dartinsight.common.error;

import com.dartinsight.common.trace.TraceContext;
import jakarta.validation.ConstraintViolationException;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/**
 * 컨트롤러에서 나온 예외를 공통 에러 형식({@link ErrorResponse})으로 바꾼다.
 * 200 응답에 에러를 담지 않는다.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ErrorResponse> handleApi(ApiException e) {
        ErrorCode code = e.errorCode();
        if (code.status() >= 500) {
            log.warn("{}: {}", code, e.getMessage(), e.getCause());
        }
        return respond(code, e.getMessage(), List.of());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleBodyValidation(MethodArgumentNotValidException e) {
        List<ErrorResponse.FieldError> errors = e.getBindingResult().getFieldErrors().stream()
                .map(f -> new ErrorResponse.FieldError(f.getField(), f.getDefaultMessage()))
                .toList();
        return invalidInput(errors);
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    public ResponseEntity<ErrorResponse> handleParameterValidation(HandlerMethodValidationException e) {
        List<ErrorResponse.FieldError> errors = e.getParameterValidationResults().stream()
                .flatMap(result -> result.getResolvableErrors().stream()
                        .map(error -> new ErrorResponse.FieldError(
                                result.getMethodParameter().getParameterName(), error.getDefaultMessage())))
                .toList();
        return invalidInput(errors);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ErrorResponse> handleConstraintViolation(ConstraintViolationException e) {
        List<ErrorResponse.FieldError> errors = e.getConstraintViolations().stream()
                .map(v -> {
                    String path = v.getPropertyPath().toString();
                    String field = path.contains(".") ? path.substring(path.lastIndexOf('.') + 1) : path;
                    return new ErrorResponse.FieldError(field, v.getMessage());
                })
                .toList();
        return invalidInput(errors);
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ErrorResponse> handleMissingParameter(MissingServletRequestParameterException e) {
        return invalidInput(List.of(new ErrorResponse.FieldError(e.getParameterName(), "필수 값입니다.")));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> handleTypeMismatch(MethodArgumentTypeMismatchException e) {
        return invalidInput(List.of(new ErrorResponse.FieldError(e.getName(), "값의 형식이 맞지 않습니다.")));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleUnreadableBody(HttpMessageNotReadableException e) {
        return respond(ErrorCode.COMMON_INVALID_INPUT, "요청 본문을 읽을 수 없습니다. JSON 형식을 확인해 주세요.",
                List.of());
    }

    @ExceptionHandler({NoResourceFoundException.class, NoHandlerFoundException.class})
    public ResponseEntity<ErrorResponse> handleNotFound(Exception e) {
        return respond(ErrorCode.COMMON_NOT_FOUND, ErrorCode.COMMON_NOT_FOUND.defaultMessage(), List.of());
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleMethodNotAllowed(HttpRequestMethodNotSupportedException e) {
        return respond(ErrorCode.COMMON_METHOD_NOT_ALLOWED,
                ErrorCode.COMMON_METHOD_NOT_ALLOWED.defaultMessage(), List.of());
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnexpected(Exception e) {
        // 지원하지 않는 Content-Type, 필수 헤더 없음처럼 Spring MVC가 4xx로 정한 요청 오류는 그 상태 코드를 지킨다
        if (e instanceof org.springframework.web.ErrorResponse springError
                && springError.getStatusCode().is4xxClientError()) {
            return ResponseEntity.status(springError.getStatusCode())
                    .body(ErrorResponse.of(ErrorCode.COMMON_INVALID_INPUT,
                            ErrorCode.COMMON_INVALID_INPUT.defaultMessage(), TraceContext.currentTraceId(),
                            List.of()));
        }
        log.error("처리하지 못한 오류", e);
        return respond(ErrorCode.COMMON_INTERNAL_ERROR, ErrorCode.COMMON_INTERNAL_ERROR.defaultMessage(),
                List.of());
    }

    private ResponseEntity<ErrorResponse> invalidInput(List<ErrorResponse.FieldError> errors) {
        return respond(ErrorCode.COMMON_INVALID_INPUT, ErrorCode.COMMON_INVALID_INPUT.defaultMessage(), errors);
    }

    private ResponseEntity<ErrorResponse> respond(ErrorCode code, String message,
            List<ErrorResponse.FieldError> errors) {
        return ResponseEntity.status(code.status())
                .body(ErrorResponse.of(code, message, TraceContext.currentTraceId(), errors));
    }
}
