package com.dartinsight.favorite.service;

import static com.dartinsight.dart.client.DisclosureListJson.item;
import static com.dartinsight.dart.client.DisclosureListJson.page;
import static org.assertj.core.api.Assertions.assertThat;

import com.dartinsight.company.service.CompanyImportService;
import com.dartinsight.dart.client.DisclosureListJson;
import com.dartinsight.dart.client.FakeOpenDartServer;
import com.dartinsight.dart.client.FakeOpenDartServer.Response;
import com.dartinsight.dart.domain.CorpCodeEntry;
import com.dartinsight.favorite.domain.FavoriteReportFound;
import com.dartinsight.support.TestData;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.context.event.RecordApplicationEvents;

@SpringBootTest
@RecordApplicationEvents
class FavoriteReportPollerTest {

    private static final FakeOpenDartServer SERVER = startServer();

    @DynamicPropertySource
    static void openDart(DynamicPropertyRegistry registry) {
        registry.add("app.opendart.base-url", SERVER::baseUrl);
        registry.add("app.opendart.read-timeout", () -> "2s");
    }

    private static FakeOpenDartServer startServer() {
        try {
            return new FakeOpenDartServer();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    @Autowired
    private FavoriteReportPoller poller;

    @Autowired
    private CompanyImportService companyImportService;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private ApplicationEvents events;

    @BeforeEach
    void setUp() {
        clear();
        companyImportService.save(List.of(
                new CorpCodeEntry("00000001", "예시전자", null, "900001", LocalDate.of(2026, 1, 1)),
                new CorpCodeEntry("00000002", "예시화학", null, "900002", LocalDate.of(2026, 1, 1)),
                new CorpCodeEntry("00000003", "예시건설", null, "900003", LocalDate.of(2026, 1, 1))));
    }

    // 회원 표를 지우는 다른 테스트가 외래 키에 걸리지 않게 끝날 때도 지운다
    @AfterEach
    void clear() {
        TestData.clearAll(jdbc);
        jdbc.update("DELETE FROM refresh_token");
        jdbc.update("DELETE FROM social_account");
        jdbc.update("DELETE FROM local_credential");
        jdbc.update("DELETE FROM app_user");
    }

    @Test
    @DisplayName("즐겨찾기 기업의 새 정기보고서만 한 번 알리고, 처음 받은 목록과 즐겨찾기하지 않은 기업은 알리지 않는다")
    void publishesOnlyNewReportsOfFavoriteCompanies() {
        // 두 회원이 같은 기업을 골랐어도 그 기업은 한 번만 부른다
        favorite(newUser(), "00000001");
        favorite(newUser(), "00000001");
        SERVER.on("/api/list.json",
                Response.json(page(1, 1, item("20260515000001", "분기보고서 (2026.03)", "20260515", ""))),
                Response.json(page(1, 1,
                        item("20260814000001", "반기보고서 (2026.06)", "20260814", ""),
                        item("20260515000001", "분기보고서 (2026.03)", "20260515", ""))));
        int before = SERVER.requests().size();

        poller.poll();
        assertThat(events.stream(FavoriteReportFound.class)).isEmpty();

        poller.poll();
        poller.poll();
        assertThat(events.stream(FavoriteReportFound.class))
                .containsExactly(new FavoriteReportFound("00000001", "20260814000001"));

        List<String> requests = SERVER.requests().subList(before, SERVER.requests().size());
        assertThat(requests).hasSize(3).allMatch(uri -> uri.contains("corp_code=00000001"));
    }

    @Test
    @DisplayName("리스너가 한 이벤트에서 실패해도 나머지 새 보고서는 알린다")
    void keepsPublishingWhenListenerFails() {
        favorite(newUser(), "00000001");
        SERVER.on("/api/list.json",
                Response.json(page(1, 1, item("20260515000001", "분기보고서 (2026.03)", "20260515", ""))),
                Response.json(page(1, 1,
                        item(FailingListener.FAIL, "반기보고서 (2026.06)", "20260814", ""),
                        item("20261114000001", "분기보고서 (2026.09)", "20261114", ""),
                        item("20260515000001", "분기보고서 (2026.03)", "20260515", ""))));
        poller.poll();
        FailingListener.RECEIVED.clear();

        poller.poll();

        assertThat(FailingListener.RECEIVED).containsExactlyInAnyOrder(
                new FavoriteReportFound("00000001", FailingListener.FAIL),
                new FavoriteReportFound("00000001", "20261114000001"));
    }

    @TestConfiguration
    static class FailingListener {
        static final String FAIL = "20260814000009";
        static final List<FavoriteReportFound> RECEIVED = new CopyOnWriteArrayList<>();

        @EventListener
        void on(FavoriteReportFound event) {
            RECEIVED.add(event);
            if (FAIL.equals(event.rceptNo())) {
                throw new IllegalStateException("리스너 실패");
            }
        }
    }

    @Test
    @DisplayName("OpenDART 호출 한도에 걸리면 그 회차의 나머지 기업은 부르지 않는다")
    void stopsRoundWhenRateLimited() {
        long user = newUser();
        favorite(user, "00000001");
        favorite(user, "00000002");
        SERVER.on("/api/list.json", Response.json(DisclosureListJson.RATE_LIMITED));
        int before = SERVER.requests().size();

        poller.poll();

        assertThat(SERVER.requests().subList(before, SERVER.requests().size()))
                .singleElement().asString().contains("corp_code=00000001");
        assertThat(events.stream(FavoriteReportFound.class)).isEmpty();
    }

    private long newUser() {
        jdbc.update("INSERT INTO app_user (created_at, updated_at) VALUES (CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)");
        return jdbc.queryForObject("SELECT MAX(id) FROM app_user", Long.class);
    }

    private void favorite(long userId, String corpCode) {
        jdbc.update("INSERT INTO favorite_company (user_id, corp_code, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
                userId, corpCode);
    }
}
