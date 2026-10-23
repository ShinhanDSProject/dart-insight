package com.dartinsight.auth.dto;

public record SessionRequest(Object email, Object password) {
    @Override
    public String toString() { return "SessionRequest[redacted]"; }
}
