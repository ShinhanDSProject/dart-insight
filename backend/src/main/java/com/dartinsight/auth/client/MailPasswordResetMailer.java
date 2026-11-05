package com.dartinsight.auth.client;

import com.dartinsight.auth.config.PasswordResetProperties;
import java.util.Properties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Component;

/**
 * 재설정 링크를 Gmail SMTP 등으로 보낸다(ADR-0055). 메일 호스트가 비어 있으면 보내지 않는다.
 * 그때 로컬 개발자가 logLinkWithoutMail을 켰고 링크가 로컬 화면 주소일 때만 링크를 로그에 남긴다(받는 이메일은 빼고).
 * 그 밖에는(운영에서 설정을 빠뜨린 경우 포함) 토큰이 로그에 남지 않게 경고만 남긴다.
 */
@Component
public class MailPasswordResetMailer implements PasswordResetMailer {
    private static final Logger log = LoggerFactory.getLogger(MailPasswordResetMailer.class);
    static final String SUBJECT = "[DART Insight] 비밀번호 재설정 링크";

    private final JavaMailSenderImpl sender;
    private final String from;
    private final boolean logLinkWithoutMail;

    public MailPasswordResetMailer(PasswordResetProperties properties) {
        this.sender = properties.smtpConfigured() ? smtp(properties) : null;
        this.from = properties.sender();
        this.logLinkWithoutMail = properties.logLinkWithoutMail();
    }

    @Override
    public void send(String toEmail, String resetLink) {
        if (sender == null) {
            if (mayLogLink(logLinkWithoutMail, resetLink)) {
                log.info("[로컬 개발] 메일 설정이 없어 비밀번호 재설정 링크를 로그에 남깁니다: {}", resetLink);
            } else {
                log.warn("메일 설정(MAIL_HOST)이 없어 비밀번호 재설정 메일을 보내지 못했습니다");
            }
            return;
        }
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from);
        message.setTo(toEmail);
        message.setSubject(SUBJECT);
        message.setText(body(resetLink));
        sender.send(message);
    }

    /** 링크를 로그에 남겨도 되는지: 로컬 개발자가 켰고 로컬 화면 주소일 때만 */
    static boolean mayLogLink(boolean enabled, String resetLink) {
        return enabled && isLocalLink(resetLink);
    }

    /** 로컬 개발 화면 주소인지 */
    static boolean isLocalLink(String resetLink) {
        return resetLink.startsWith("http://localhost:") || resetLink.startsWith("http://localhost/")
                || resetLink.startsWith("http://127.0.0.1:") || resetLink.startsWith("http://127.0.0.1/");
    }

    static String body(String resetLink) {
        return """
                DART Insight 비밀번호 재설정을 요청하셨어요.

                아래 링크에서 새 비밀번호를 정해 주세요. 링크는 30분 동안 한 번만 쓸 수 있어요.
                %s

                요청하지 않으셨다면 이 메일을 무시해 주세요. 비밀번호는 바뀌지 않아요.
                """.formatted(resetLink);
    }

    private static JavaMailSenderImpl smtp(PasswordResetProperties properties) {
        JavaMailSenderImpl smtp = new JavaMailSenderImpl();
        smtp.setHost(properties.mailHost());
        smtp.setPort(properties.mailPort());
        smtp.setUsername(properties.mailUsername());
        smtp.setPassword(properties.mailPassword());
        smtp.setDefaultEncoding("UTF-8");
        Properties mail = smtp.getJavaMailProperties();
        mail.put("mail.smtp.auth", "true");
        mail.put("mail.smtp.starttls.enable", "true");
        mail.put("mail.smtp.starttls.required", "true");
        // 메일 서버가 느려도 발송 스레드를 오래 잡지 않는다
        mail.put("mail.smtp.connectiontimeout", "5000");
        mail.put("mail.smtp.timeout", "10000");
        mail.put("mail.smtp.writetimeout", "10000");
        return smtp;
    }
}
