package com.dartinsight.disclosure.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.dartinsight.company.service.CompanyImportService;
import com.dartinsight.dart.domain.CorpCodeEntry;
import com.dartinsight.disclosure.domain.Disclosure;
import com.dartinsight.disclosure.domain.DisclosureFetch;
import com.dartinsight.support.TestData;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;

/** DisclosureStore SQL을 실제 DB(H2, CI는 MariaDB)에서 확인한다(T-3). */
@SpringBootTest
class DisclosureStoreTest {

    private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 26, 9, 0, 0, 123_456_000);

    @Autowired
    private DisclosureStore store;

    @Autowired
    private CompanyImportService companyImportService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private TransactionTemplate transactionTemplate;

    @BeforeEach
    void setUp() {
        TestData.clearAll(jdbcTemplate);
        companyImportService.save(List.of(
                new CorpCodeEntry("00000001", "예시전자", null, "900001", LocalDate.of(2026, 1, 1)),
                new CorpCodeEntry("00000002", "예시화학", null, null, LocalDate.of(2026, 1, 1))));
    }

    private static Disclosure disclosure(String rceptNo, LocalDate date) {
        return new Disclosure(rceptNo, "최대주주등소유주식변동신고서", "예시전자", date, null);
    }

    @Test
    @DisplayName("저장한 목록과 받은 기록을 다시 읽는다")
    void savesAndReadsBack() {
        DisclosureFetch fetch = new DisclosureFetch("00000001", LocalDate.of(2026, 7, 28), LocalDate.of(2026, 10, 26),
                NOW);
        transactionTemplate.executeWithoutResult(s -> store.replace(fetch, List.of(
                new Disclosure("20260814000001", "반기보고서 (2026.06)", "예시전자", LocalDate.of(2026, 8, 14), "유"),
                disclosure("20261020000002", LocalDate.of(2026, 10, 20)),
                disclosure("20261020000005", LocalDate.of(2026, 10, 20)))));

        assertThat(store.findFetch("00000001")).contains(fetch);
        assertThat(store.findFetch("00000002")).isEmpty();
        List<Disclosure> all = store.findSince("00000001", LocalDate.of(2026, 7, 28));
        assertThat(all).extracting(Disclosure::rceptNo)
                .containsExactly("20261020000005", "20261020000002", "20260814000001");
        assertThat(all.get(2)).isEqualTo(
                new Disclosure("20260814000001", "반기보고서 (2026.06)", "예시전자", LocalDate.of(2026, 8, 14), "유"));
        assertThat(store.findSince("00000001", LocalDate.of(2026, 10, 1))).hasSize(2);
        assertThat(store.findAll("00000001")).extracting(Disclosure::rceptNo)
                .containsExactly("20261020000005", "20261020000002", "20260814000001");
        assertThat(store.findAll("00000002")).isEmpty();
    }

    @Test
    @DisplayName("다시 저장하면 그 기업의 이전 목록만 바꾼다")
    void replaceSwapsOnlyThatCompany() {
        LocalDate from = LocalDate.of(2026, 7, 28);
        LocalDate to = LocalDate.of(2026, 10, 26);
        transactionTemplate.executeWithoutResult(s -> {
            store.replace(new DisclosureFetch("00000001", from, to, NOW),
                    List.of(disclosure("20261020000001", LocalDate.of(2026, 10, 20))));
            store.replace(new DisclosureFetch("00000002", from, to, NOW),
                    List.of(disclosure("20261020000001", LocalDate.of(2026, 10, 20))));
        });

        DisclosureFetch again = new DisclosureFetch("00000001", from, to, NOW.plusHours(2));
        transactionTemplate.executeWithoutResult(s -> store.replace(again,
                List.of(disclosure("20261026000001", LocalDate.of(2026, 10, 26)))));

        assertThat(store.findFetch("00000001")).contains(again);
        assertThat(store.findSince("00000001", from)).extracting(Disclosure::rceptNo).containsExactly("20261026000001");
        assertThat(store.findSince("00000002", from)).extracting(Disclosure::rceptNo).containsExactly("20261020000001");
    }
}
