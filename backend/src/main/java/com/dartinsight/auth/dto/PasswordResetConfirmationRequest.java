package com.dartinsight.auth.dto;

/** 재설정 링크의 토큰과 새 비밀번호. 로그에 남지 않게 toString을 가린다 */
public record PasswordResetConfirmationRequest(Object token, Object password) {
    @Override
    public String toString() { return "PasswordResetConfirmationRequest[redacted]"; }
}
