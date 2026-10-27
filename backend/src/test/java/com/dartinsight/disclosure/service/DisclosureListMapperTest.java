package com.dartinsight.disclosure.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.dartinsight.dart.dto.DisclosureListResponse;
import com.dartinsight.disclosure.domain.Disclosure;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class DisclosureListMapperTest {

    private static final String CORP_CODE = "00126380";

    private static DisclosureListResponse.Item item(String corpCode, String rceptNo, String reportName, String rceptDt,
            String filerName, String remark) {
        return new DisclosureListResponse.Item(corpCode, "삼성전자", "005930", "Y", reportName, rceptNo, filerName,
                rceptDt, remark);
    }

    @Test
    @DisplayName("읽을 수 있는 이 기업의 줄만 옮기고, 같은 접수번호는 처음 것 하나만 둔다")
    void keepsReadableRowsOnce() {
        List<Disclosure> disclosures = DisclosureListMapper.toDisclosures(CORP_CODE, List.of(
                item(CORP_CODE, "20261014000001", " 분기보고서 (2026.09) ", "20261014", " ", "정"),
                item(CORP_CODE, "20261014000001", "다른 이름", "20261014", "삼성전자", null),
                item("00000001", "20261014000002", "주식소각결정", "20261014", "다른회사", null),
                item(CORP_CODE, "20261014000003", "주식소각결정", "2026-10-14", "삼성전자", null),
                item(CORP_CODE, " ", "주식소각결정", "20261014", "삼성전자", null)));

        assertThat(disclosures).containsExactly(new Disclosure("20261014000001", "분기보고서 (2026.09)", null,
                LocalDate.of(2026, 10, 14), "정"));
    }
}
