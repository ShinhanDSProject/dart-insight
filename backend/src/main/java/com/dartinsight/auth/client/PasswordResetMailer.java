package com.dartinsight.auth.client;

/** 비밀번호 재설정 링크를 보낸다(ADR-0055). 구현은 MailPasswordResetMailer, 테스트는 기록만 하는 가짜로 바꾼다 */
public interface PasswordResetMailer {
    void send(String toEmail, String resetLink);
}
