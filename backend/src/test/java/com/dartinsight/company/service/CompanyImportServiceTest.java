package com.dartinsight.company.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.dartinsight.company.domain.Company;
import com.dartinsight.company.repository.CompanyRepository;
import com.dartinsight.dart.dto.CorpCodeEntry;
import com.dartinsight.support.TestData;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest
class CompanyImportServiceTest {

    @Autowired
    private CompanyImportService importService;

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

    @Test
    void insertsNewCompanies() {
        CompanyImportService.ImportResult result = importService.save(List.of(
                entry("00000001", "예시전자", "900001"),
                entry("00000002", "예시비상장", null)));

        assertThat(result).isEqualTo(new CompanyImportService.ImportResult(2, 2, 0));
        assertThat(companyRepository.findById("00000002")).get()
                .satisfies(c -> assertThat(c.isListed()).isFalse());
    }

    @Test
    void runningAgainUpdatesWithoutDuplicates() {
        importService.save(List.of(entry("00000001", "예시전자", "900001"), entry("00000002", "예시비상장", null)));

        CompanyImportService.ImportResult result = importService.save(List.of(
                entry("00000001", "예시전자홀딩스", "900001"),
                entry("00000002", "예시비상장", null),
                entry("00000003", "예시화학", "900003")));

        assertThat(result).isEqualTo(new CompanyImportService.ImportResult(3, 1, 1));
        assertThat(companyRepository.count()).isEqualTo(3);
        assertThat(companyRepository.findById("00000001")).get()
                .extracting(Company::getCorpName).isEqualTo("예시전자홀딩스");
    }

    @Test
    void savesMoreThanOneChunk() {
        List<CorpCodeEntry> many = new java.util.ArrayList<>();
        for (int i = 0; i < CompanyImportService.CHUNK_SIZE + 5; i++) {
            many.add(entry(String.format("%08d", i + 1), "예시회사" + i, null));
        }

        CompanyImportService.ImportResult result = importService.save(many);

        assertThat(result.inserted()).isEqualTo(CompanyImportService.CHUNK_SIZE + 5);
        assertThat(companyRepository.count()).isEqualTo(CompanyImportService.CHUNK_SIZE + 5);
    }
}
