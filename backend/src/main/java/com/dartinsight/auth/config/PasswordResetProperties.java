package com.dartinsight.auth.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * 비밀번호 재설정(6.8, ADR-0055). 메일 계정·비밀번호는 .env·서버 환경변수에만 둔다.
 * mailHost가 비어 있으면 메일을 보내지 않는다. 링크를 로그에 남기는 것은 logLinkWithoutMail을 켜고 로컬 주소일 때뿐이다.
 */
@ConfigurationProperties(prefix = "app.password-reset")
public record PasswordResetProperties(
        // 메일의 링크가 여는 화면. 배포 서버에서는 https 주소로 바꾼다
        @DefaultValue("http://localhost:5173/password-reset") String pageUrl,
        @DefaultValue("30m") Duration tokenTtl,
        // 같은 회원이 이 시간 안에 다시 요청하면 새 링크·메일을 만들지 않는다
        @DefaultValue("1m") Duration resendInterval,
        // 메일 발송을 요청 응답과 따로 한다(응답 시간으로 가입 여부를 알 수 없게). 테스트는 끈다
        @DefaultValue("true") boolean async,
        @DefaultValue("") String mailHost,
        @DefaultValue("587") int mailPort,
        @DefaultValue("") String mailUsername,
        @DefaultValue("") String mailPassword,
        // 보내는 사람. 비우면 mailUsername
        @DefaultValue("") String mailFrom,
        // 메일 설정이 없을 때 링크(토큰 포함)를 로그에 남길지. 로컬 개발에서만 .env로 켠다. 기본은 남기지 않는다
        @DefaultValue("false") boolean logLinkWithoutMail) {

    public boolean smtpConfigured() { return !mailHost.isBlank(); }

    public String sender() { return mailFrom.isBlank() ? mailUsername : mailFrom; }

    @Override
    public String toString() { return "PasswordResetProperties[redacted]"; }
}
