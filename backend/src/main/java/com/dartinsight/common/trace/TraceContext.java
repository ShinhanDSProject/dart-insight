package com.dartinsight.common.trace;

import java.util.UUID;
import java.util.regex.Pattern;
import org.slf4j.MDC;

/**
 * 요청 추적 ID(X-Trace-Id). 요청마다 MDC에 넣어 로그와 에러 응답, AI 서버 호출에 같은 값을 쓴다.
 */
public final class TraceContext {

    public static final String HEADER = "X-Trace-Id";
    public static final String MDC_KEY = "traceId";

    private static final Pattern VALID = Pattern.compile("[A-Za-z0-9-]{1,64}");

    private TraceContext() {
    }

    public static String currentTraceId() {
        return MDC.get(MDC_KEY);
    }

    /** 요청 헤더 값이 쓸 만하면 그대로, 아니면 새로 만든다. */
    public static String resolve(String headerValue) {
        if (headerValue != null && VALID.matcher(headerValue).matches()) {
            return headerValue;
        }
        return newTraceId();
    }

    public static String newTraceId() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 16);
    }
}
