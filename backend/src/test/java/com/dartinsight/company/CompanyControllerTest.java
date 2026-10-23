package com.dartinsight.company;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dartinsight.dart.dto.CorpCodeEntry;
import com.dartinsight.support.TestData;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class CompanyControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private CompanyRepository companyRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private CompanyImportService importService;

    @BeforeEach
    void setUp() {
        TestData.clearAll(jdbcTemplate);
    }

    /** 테스트용 가짜 회사들. */
    private void saveSampleCompanies() {
        importService.save(List.of(
                entry("00000001", "예시전자", "900001"),
                entry("00000002", "예시전자서비스", null),
                entry("00000003", "한국예시전자", "900003"),
                entry("00000004", "50%할인", null),
                entry("00000005", "다른회사", "900005")));
    }

    private static CorpCodeEntry entry(String code, String name, String stockCode) {
        return new CorpCodeEntry(code, name, null, stockCode, LocalDate.of(2026, 1, 1));
    }

    @Test
    void searchesByNameWithExactMatchAndListedFirst() throws Exception {
        saveSampleCompanies();

        mockMvc.perform(get("/api/companies").param("query", "예시전자"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(3)))
                .andExpect(jsonPath("$.items[0].corpCode").value("00000001"))
                .andExpect(jsonPath("$.items[0].listed").value(true))
                .andExpect(jsonPath("$.items[1].corpName").value("한국예시전자"))
                .andExpect(jsonPath("$.items[2].corpName").value("예시전자서비스"))
                .andExpect(jsonPath("$.items[2].listed").value(false));
    }

    @Test
    void searchesByStockCode() throws Exception {
        saveSampleCompanies();

        mockMvc.perform(get("/api/companies").param("query", "900005"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].corpName").value("다른회사"));
    }

    @Test
    void treatsPercentAsText() throws Exception {
        saveSampleCompanies();

        mockMvc.perform(get("/api/companies").param("query", "0%"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].corpName").value("50%할인"));
    }

    @Test
    void emptyResultIsNotAnError() throws Exception {
        saveSampleCompanies();

        mockMvc.perform(get("/api/companies").param("query", "없는회사이름"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(0)));
    }

    @Test
    void shortQueryIsInvalidInput() throws Exception {
        mockMvc.perform(get("/api/companies").param("query", " 예 "))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"))
                .andExpect(jsonPath("$.errors[0].field").value("query"));
    }

    @Test
    void limitAbove50IsInvalidInput() throws Exception {
        mockMvc.perform(get("/api/companies").param("query", "예시").param("limit", "51"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("limit"));
    }

    @Test
    void emptyCompanyTableIsNotLoaded() throws Exception {
        mockMvc.perform(get("/api/companies").param("query", "예시전자"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("COMPANY_LIST_NOT_LOADED"));
    }

    @Test
    void getsOneCompany() throws Exception {
        saveSampleCompanies();

        mockMvc.perform(get("/api/companies/00000002"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.corpName").value("예시전자서비스"))
                .andExpect(jsonPath("$.stockCode").value(org.hamcrest.Matchers.nullValue()));
    }

    @Test
    void unknownCompanyIsNotFound() throws Exception {
        mockMvc.perform(get("/api/companies/99999999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COMPANY_NOT_FOUND"));
    }
}
