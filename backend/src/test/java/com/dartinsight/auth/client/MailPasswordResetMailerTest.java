package com.dartinsight.auth.client;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class MailPasswordResetMailerTest {

    @Test
    @DisplayName("메일 설정이 없을 때 링크는 로컬 개발자가 켜고 로컬 화면 주소일 때만 로그에 남긴다")
    void onlyEnabledLocalLinksAreLogged() {
        assertThat(MailPasswordResetMailer.mayLogLink(true, "http://localhost:5173/password-reset?token=a")).isTrue();
        // 기본값(꺼짐)이면 주소가 로컬이어도 남기지 않는다(운영에서 메일·화면 주소를 함께 빠뜨린 경우)
        assertThat(MailPasswordResetMailer.mayLogLink(false, "http://localhost:5173/password-reset?token=a")).isFalse();
        assertThat(MailPasswordResetMailer.mayLogLink(true, "https://dart-insight.shinhanacademy.co.kr/password-reset?token=a")).isFalse();

        assertThat(MailPasswordResetMailer.isLocalLink("http://localhost:5173/password-reset?token=a")).isTrue();
        assertThat(MailPasswordResetMailer.isLocalLink("http://127.0.0.1:5173/password-reset?token=a")).isTrue();
        assertThat(MailPasswordResetMailer.isLocalLink("https://dart-insight.shinhanacademy.co.kr/password-reset?token=a")).isFalse();
        assertThat(MailPasswordResetMailer.isLocalLink("http://localhost.evil.example/password-reset?token=a")).isFalse();
    }
}
