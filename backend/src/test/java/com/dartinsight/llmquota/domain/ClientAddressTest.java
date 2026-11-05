package com.dartinsight.llmquota.domain;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ClientAddressTest {

    @Test
    @DisplayName("프록시(사설망·루프백)에서 온 요청은 X-Forwarded-For의 첫 주소를 쓴다")
    void trustsForwardedForFromProxy() {
        assertThat(ClientAddress.resolve("127.0.0.1", "203.0.113.7, 10.0.0.2")).isEqualTo("203.0.113.7");
        assertThat(ClientAddress.resolve("10.0.0.5", "203.0.113.8")).isEqualTo("203.0.113.8");
        assertThat(ClientAddress.resolve("192.168.0.9", " ")).isEqualTo("192.168.0.9");
    }

    @Test
    @DisplayName("밖에서 바로 온 요청은 X-Forwarded-For를 지어 보내도 연결 주소를 쓴다")
    void ignoresForwardedForFromPublicAddress() {
        assertThat(ClientAddress.resolve("203.0.113.9", "1.2.3.4")).isEqualTo("203.0.113.9");
        assertThat(ClientAddress.resolve("203.0.113.9", null)).isEqualTo("203.0.113.9");
    }
}
