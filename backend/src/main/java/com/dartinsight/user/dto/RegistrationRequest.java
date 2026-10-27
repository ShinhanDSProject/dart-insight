package com.dartinsight.user.dto;

/** Object로 받아 숫자/배열 등을 문자열로 강제 변환하지 않고 검증한다. */
public record RegistrationRequest(Object email, Object password) {
    @Override
    public String toString() { return "RegistrationRequest[redacted]"; }
}
