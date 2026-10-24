package com.dartinsight.company.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.dartinsight.company.domain.Company;
import com.dartinsight.dart.domain.CorpCodeEntry;
import com.dartinsight.support.TestData;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;

/** CompanyStore·CompanyRepository 검색 SQL을 실제 DB(H2, CI는 MariaDB)에서 확인한다(T-3). */
@SpringBootTest
class CompanyStoreTest {

    private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 25, 9, 0);

    @Autowired
    private CompanyStore companyStore;

    @Autowired
    private CompanyRepository companyRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void clean() {
        TestData.clearAll(jdbcTemplate);
    }

    private static CorpCodeEntry entry(String code, String name, String stockCode) {
        return new CorpCodeEntry(code, name, null, stockCode, LocalDate.of(2026, 1, 1));
    }

    private void insertSamples() {
        companyStore.insertAll(List.of(
                entry("00000001", "삼성전자", "005930"),
                entry("00000002", "삼성전자서비스", null),
                entry("00000003", "삼성SDI", "006400"),
                entry("00000004", "LG 전자", "066570")), NOW);
    }

    /** 이 컬럼이 생기기 전에 받아 둔 행처럼 검색용 이름을 비운 행을 넣는다. */
    private void insertWithoutNameKeys(String code, String name) {
        jdbcTemplate.update("INSERT INTO company (corp_code, corp_name, created_at, updated_at) VALUES (?, ?, ?, ?)",
                code, name, NOW, NOW);
    }

    private static List<String> names(List<Company> companies) {
        return companies.stream().map(Company::getCorpName).toList();
    }

    @Test
    @DisplayName("일괄로 넣을 때 공백 뺀 소문자 이름과 초성을 함께 채운다")
    void insertAllFillsNameKeys() {
        insertSamples();

        assertThat(companyRepository.findByCorpCode("00000004")).get().satisfies(c -> {
            assertThat(c.getCorpNameKey()).isEqualTo("lg전자");
            assertThat(c.getCorpNameChosung()).isEqualTo("lgㅈㅈ");
        });
    }

    @Test
    @DisplayName("초성으로 찾으면 초성이 정확히 같은 회사가 먼저 나온다")
    void searchesByChosungWithExactMatchFirst() {
        insertSamples();

        List<Company> result = companyRepository.searchByChosung("%ㅅㅅㅈㅈ%", "ㅅㅅㅈㅈ", PageRequest.of(0, 10));

        assertThat(names(result)).containsExactly("삼성전자", "삼성전자서비스");
    }

    @Test
    @DisplayName("공백을 뺀 이름으로 찾아 띄어 쓴 검색어와 띄어 쓴 회사명이 모두 맞는다")
    void searchesByNameKeyIgnoringSpaces() {
        insertSamples();

        assertThat(names(companyRepository.searchByNameKey("%삼성전자%", "삼성전자", PageRequest.of(0, 10))))
                .containsExactly("삼성전자", "삼성전자서비스");
        assertThat(names(companyRepository.searchByNameKey("%lg전자%", "lg전자", PageRequest.of(0, 10))))
                .containsExactly("LG 전자");
        assertThat(names(companyRepository.searchByNameKey("%sdi%", "sdi", PageRequest.of(0, 10))))
                .containsExactly("삼성SDI");
    }

    @Test
    @DisplayName("검색용 이름이 빈 행만 limit건씩 채우고, 다시 불러도 바뀌지 않는다")
    void fillMissingNameKeysIsBatchedAndIdempotent() {
        insertSamples();
        insertWithoutNameKeys("00000011", "현대 자동차");
        insertWithoutNameKeys("00000012", "기아");
        insertWithoutNameKeys("00000013", "카카오뱅크");

        assertThat(companyStore.fillMissingNameKeys(2)).isEqualTo(2);
        assertThat(companyStore.fillMissingNameKeys(2)).isEqualTo(1);
        assertThat(companyStore.fillMissingNameKeys(2)).isZero();

        assertThat(companyRepository.findByCorpCode("00000011")).get().satisfies(c -> {
            assertThat(c.getCorpNameKey()).isEqualTo("현대자동차");
            assertThat(c.getCorpNameChosung()).isEqualTo("ㅎㄷㅈㄷㅊ");
            assertThat(c.getUpdatedAt()).isEqualTo(NOW);
        });
        assertThat(names(companyRepository.searchByChosung("%ㅋㅋㅇ%", "ㅋㅋㅇ", PageRequest.of(0, 10))))
                .containsExactly("카카오뱅크");
    }
}
