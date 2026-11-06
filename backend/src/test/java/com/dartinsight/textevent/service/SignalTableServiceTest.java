package com.dartinsight.textevent.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.dartinsight.aiserver.client.AiServerClient;
import com.dartinsight.aiserver.client.AiServerPaths;
import com.dartinsight.aiserver.client.FakeAiServer;
import com.dartinsight.aiserver.client.FakeAiServer.Reply;
import com.dartinsight.aiserver.config.AiServerProperties;
import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import java.time.Duration;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** 기준표를 ai-server에서 받아 버전별로 두는 규칙(ADR-0060). 서비스마다 메모리가 따로라 새 서비스로 본다. */
class SignalTableServiceTest {

    private static final String TABLE = """
            {"version":"%s","signalNotice":"공시상 신호이며 투자 판단이 아니에요.","kinds":[],"glossary":[]}""";

    private FakeAiServer ai;
    private SignalTableService service;

    @BeforeEach
    void setUp() {
        ai = new FakeAiServer();
        service = new SignalTableService(new AiServerClient(new AiServerProperties(ai.baseUrl(),
                Duration.ofSeconds(2), Duration.ofSeconds(5), Duration.ofSeconds(1), Duration.ofSeconds(5))));
    }

    @AfterEach
    void tearDown() {
        ai.close();
    }

    @Test
    @DisplayName("한 번도 받지 못했으면 503 AI_SERVER_UNAVAILABLE이다")
    void neverFetchedIsUnavailable() {
        ai.on(AiServerPaths.SIGNAL_TABLES, Reply.error(500, "COMMON_INTERNAL_ERROR", "오류"));

        assertThatThrownBy(() -> service.current()).isInstanceOfSatisfying(ApiException.class,
                e -> assertThat(e.errorCode()).isEqualTo(ErrorCode.AI_SERVER_UNAVAILABLE));
    }

    @Test
    @DisplayName("사건의 기준표 버전은 받아 둔 표에서 찾고, 지금 표의 버전이 다르면 쓰지 않는다")
    void tableOfVersionMustMatch() {
        ai.on(AiServerPaths.SIGNAL_TABLES, Reply.ok(TABLE.formatted("signal-table-2")));
        service.current();
        ai.on(AiServerPaths.SIGNAL_TABLES, Reply.ok(TABLE.formatted("signal-table-3")));

        assertThat(service.table("signal-table-2").version()).isEqualTo("signal-table-2");
        assertThatThrownBy(() -> service.table("signal-table-1")).isInstanceOf(IllegalStateException.class);
    }
}
