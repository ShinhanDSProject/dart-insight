package com.dartinsight.company.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.dartinsight.company.domain.CompanyOverview;
import com.dartinsight.company.service.CompanyImportService;
import com.dartinsight.dart.domain.CompanyOverviewEntry;
import com.dartinsight.dart.domain.CorpCodeEntry;
import com.dartinsight.support.TestData;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest
class CompanyOverviewRepositoryTest {

    private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 26, 10, 0, 0, 123_456_000);

    @Autowired
    private CompanyOverviewRepository repository;

    @Autowired
    private CompanyImportService importService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        TestData.clearAll(jdbcTemplate);
        importService.save(List.of(new CorpCodeEntry("00126380", "삼성전자", null, "005930", LocalDate.of(2026, 1, 1))));
    }

    private static CompanyOverviewEntry samsung() {
        return new CompanyOverviewEntry("삼성전자(주)", "SAMSUNG ELECTRONICS CO,.LTD", "삼성전자", "005930", "전영현, 노태문",
                "Y", "264", LocalDate.of(1969, 1, 13), 12, "www.samsung.com/sec", null,
                "경기도 수원시 영통구  삼성로 129 (매탄동)", "02-2255-0114");
    }

    @Test
    @DisplayName("저장한 개황을 고유번호로 찾으면 모든 값과 받은 시각이 그대로다")
    void savesAndFindsByCorpCode() {
        repository.save(CompanyOverview.create("00126380", Optional.of(samsung()), NOW));

        CompanyOverview found = repository.findByCorpCode("00126380").orElseThrow();

        assertThat(found.getId()).isNotNull();
        assertThat(found.getStatus()).isEqualTo(CompanyOverview.Status.OK);
        assertThat(found.getCorpName()).isEqualTo("삼성전자(주)");
        assertThat(found.getCeoName()).isEqualTo("전영현, 노태문");
        assertThat(found.getCorpClass()).isEqualTo("Y");
        assertThat(found.getEstablishedDate()).isEqualTo(LocalDate.of(1969, 1, 13));
        assertThat(found.getAccountingMonth()).isEqualTo(12);
        assertThat(found.getIrUrl()).isNull();
        assertThat(found.getAddress()).isEqualTo("경기도 수원시 영통구  삼성로 129 (매탄동)");
        assertThat(found.getFetchedAt()).isEqualTo(NOW);
    }

    @Test
    @DisplayName("자료 없음(013)은 NO_DATA로 저장하고 값은 모두 null이다")
    void savesNoData() {
        repository.save(CompanyOverview.create("00126380", Optional.empty(), NOW));

        CompanyOverview found = repository.findByCorpCode("00126380").orElseThrow();

        assertThat(found.isAvailable()).isFalse();
        assertThat(found.getStatus()).isEqualTo(CompanyOverview.Status.NO_DATA);
        assertThat(found.getCorpName()).isNull();
        assertThat(found.getEstablishedDate()).isNull();
    }

    @Test
    @DisplayName("같은 회사의 개황을 두 행 넣으면 UNIQUE(corp_code)에 걸린다")
    void corpCodeIsUnique() {
        repository.saveAndFlush(CompanyOverview.create("00126380", Optional.of(samsung()), NOW));

        assertThatThrownBy(() -> repository.saveAndFlush(CompanyOverview.create("00126380", Optional.empty(), NOW)))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
