package com.dartinsight.financial.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.dartinsight.dart.domain.CorpCodeEntry;
import com.dartinsight.company.service.CompanyImportService;
import com.dartinsight.financial.domain.FetchStatus;
import com.dartinsight.financial.domain.FsDiv;
import com.dartinsight.financial.domain.KeyAccount;
import com.dartinsight.financial.domain.KeyAccountFetch;
import com.dartinsight.financial.domain.KeyAccountRow;
import com.dartinsight.support.TestData;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;

/** KeyAccountStore SQL을 실제 DB(H2, CI는 MariaDB)에서 확인한다(T-3). */
@SpringBootTest
class KeyAccountStoreTest {

    private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 26, 9, 0);
    private static final String HALF = "20260814000001";
    private static final String Q1 = "20260515000001";

    @Autowired
    private KeyAccountStore store;

    @Autowired
    private CompanyImportService companyImportService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        TestData.clearAll(jdbcTemplate);
        companyImportService.save(List.of(
                new CorpCodeEntry("00000001", "예시전자", null, "900001", LocalDate.of(2026, 1, 1))));
        insertReport(HALF, "반기보고서 (2026.06)", "HALF", LocalDate.of(2026, 6, 30));
        insertReport(Q1, "분기보고서 (2026.03)", "Q1", LocalDate.of(2026, 3, 31));
    }

    private void insertReport(String rceptNo, String name, String type, LocalDate periodEnd) {
        jdbcTemplate.update("INSERT INTO report (rcept_no, corp_code, report_name, report_type, fiscal_year, "
                + "period_end, rcept_dt, correction, last_seen_at, created_at, updated_at) "
                + "VALUES (?, '00000001', ?, ?, 2026, ?, ?, 'ORIGINAL', ?, ?, ?)",
                rceptNo, name, type, periodEnd, periodEnd.plusMonths(1), NOW, NOW, NOW);
    }

    private static KeyAccountRow row(FsDiv fsDiv, KeyAccount account, Long amount, Long cumulative) {
        return new KeyAccountRow(HALF, fsDiv, account, account.sjDiv(), account.label(), 1, amount, cumulative,
                "KRW");
    }

    @Test
    @DisplayName("받은 기록과 계정 값을 저장하고, null 금액은 null로, 0은 0으로 읽는다")
    void savesAndReadsRowsKeepingNullAndZeroApart() {
        store.save(new KeyAccountFetch(HALF, FetchStatus.OK, "20260901000001", NOW), List.of(
                row(FsDiv.CFS, KeyAccount.REVENUE, 171L, 305L),
                row(FsDiv.CFS, KeyAccount.OPERATING_INCOME, 0L, null),
                row(FsDiv.OFS, KeyAccount.REVENUE, 100L, 200L)));
        store.save(new KeyAccountFetch(Q1, FetchStatus.NO_DATA, null, NOW), List.of());

        Map<String, KeyAccountFetch> fetches = store.fetches(List.of(HALF, Q1, "20990101000001"));
        assertThat(fetches).containsOnlyKeys(HALF, Q1);
        assertThat(fetches.get(HALF).sourceRceptNo()).isEqualTo("20260901000001");
        assertThat(fetches.get(HALF).fetchedAt()).isEqualTo(NOW);
        assertThat(fetches.get(Q1).status()).isEqualTo(FetchStatus.NO_DATA);
        assertThat(fetches.get(Q1).sourceRceptNo()).isNull();

        List<KeyAccountRow> cfs = store.rows(List.of(HALF, Q1), FsDiv.CFS);
        assertThat(cfs).hasSize(2);
        KeyAccountRow operating = cfs.stream().filter(r -> r.account() == KeyAccount.OPERATING_INCOME)
                .findFirst().orElseThrow();
        assertThat(operating.amount()).isZero();
        assertThat(operating.cumulativeAmount()).isNull();
        assertThat(operating.ord()).isEqualTo(1);
        assertThat(store.rows(List.of(HALF), FsDiv.OFS)).singleElement()
                .satisfies(r -> assertThat(r.cumulativeAmount()).isEqualTo(200L));
        assertThat(store.rows(List.of(), FsDiv.CFS)).isEmpty();
        assertThat(store.fetches(List.of())).isEmpty();
    }

    @Test
    @DisplayName("같은 보고서를 두 번 저장하면 DuplicateKeyException")
    void rejectsSecondSaveOfSameReport() {
        store.save(new KeyAccountFetch(HALF, FetchStatus.NO_DATA, null, NOW), List.of());

        assertThatThrownBy(() -> store.save(new KeyAccountFetch(HALF, FetchStatus.NO_DATA, null, NOW), List.of()))
                .isInstanceOf(DuplicateKeyException.class);
    }
}
