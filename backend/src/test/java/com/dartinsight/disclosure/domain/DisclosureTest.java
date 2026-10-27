package com.dartinsight.disclosure.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class DisclosureTest {

    @ParameterizedTest(name = "{0} → {1}")
    @DisplayName("제목이 '사업보고서' 또는 '사업보고서(기간)'인 것만 사업보고서다")
    @CsvSource(delimiter = '|', textBlock = """
            사업보고서 (2025.12)               | true
            [기재정정]사업보고서 (2025.12)      | true
            사업보고서                         | true
            사업보고서제출기한연장신고서          | false
            반기보고서 (2026.06)               | false
            """)
    void detectsAnnualReport(String reportName, boolean expected) {
        Disclosure disclosure = new Disclosure("20260310000001", reportName, null, LocalDate.of(2026, 3, 10), null);

        assertThat(disclosure.isAnnualReport()).isEqualTo(expected);
    }
}
