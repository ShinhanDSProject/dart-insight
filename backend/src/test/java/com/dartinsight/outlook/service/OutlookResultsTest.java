package com.dartinsight.outlook.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.dartinsight.outlook.domain.OutlookCategory;
import com.dartinsight.outlook.domain.OutlookRecord;
import com.dartinsight.outlook.domain.OutlookSource;
import com.dartinsight.outlook.domain.OutlookStatus;
import com.dartinsight.outlook.dto.OutlookAiResponse;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class OutlookResultsTest {

    static final String R = "20260310000001";
    static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 27, 10, 0);
    static final List<OutlookSource> SOURCES = List.of(
            new OutlookSource(R + "#B4", 5, 4, "II. 사업의 내용 > 3. 원재료 및 생산설비", "당사는 평택 라인을 증설할 계획입니다.", true),
            new OutlookSource(R + "#B7", 9, 7, "IV. 이사의 경영진단 및 분석의견", "배당을 늘릴 예정입니다.", true));

    private static OutlookAiResponse response(String status, OutlookAiResponse.Item... items) {
        return new OutlookAiResponse("outlook-1", "expr-1", "fake-model", "2026-10-27T10:12:03", status,
                List.of(items), null, List.of(), List.of());
    }

    private static OutlookRecord interpret(OutlookAiResponse response) {
        return OutlookResults.interpret(R, "outlook-1", response, SOURCES, "t-1", NOW);
    }

    @Test
    @DisplayName("인용이 든 첫 근거 문단을 항목의 근거 위치로 둔다")
    void evidenceIsTheCitedBlockContainingQuote() {
        OutlookRecord row = interpret(response("GENERATED", new OutlookAiResponse.Item("INVESTMENT",
                "증설 계획을 밝혔어요.", "평택 라인을  증설할 계획", List.of(R + "#B7", R + "#B4"))));

        assertThat(row.status()).isEqualTo(OutlookStatus.GENERATED);
        assertThat(row.items()).hasSize(1);
        assertThat(row.items().getFirst().category()).isEqualTo(OutlookCategory.INVESTMENT);
        assertThat(row.items().getFirst().quote()).isEqualTo("평택 라인을 증설할 계획");
        assertThat(row.items().getFirst().evidence().blockNo()).isEqualTo(4);
        assertThat(row.items().getFirst().evidence().rceptNo()).isEqualTo(R);
        assertThat(row.generatedAt()).isEqualTo(LocalDateTime.of(2026, 10, 27, 10, 12, 3));
    }

    @Test
    @DisplayName("인용이 원문에 없거나 근거가 보낸 문단 밖이거나 종류를 모르면 항목 없이 검토 필요")
    void unverifiableItemMakesWholeResultReviewNeeded() {
        OutlookAiResponse.Item good = new OutlookAiResponse.Item("FINANCIAL", "배당 계획을 밝혔어요.", "배당을 늘릴 예정",
                List.of(R + "#B7"));
        for (OutlookAiResponse.Item bad : List.of(
                new OutlookAiResponse.Item("INVESTMENT", "증설", "평택 라인을 크게 늘릴", List.of(R + "#B4")),
                new OutlookAiResponse.Item("INVESTMENT", "증설", "평택 라인을 증설할", List.of(R + "#B99")),
                new OutlookAiResponse.Item("VALUATION", "증설", "평택 라인을 증설할", List.of(R + "#B4")))) {
            OutlookRecord row = interpret(response("GENERATED", good, bad));

            assertThat(row.status()).isEqualTo(OutlookStatus.REVIEW_NEEDED);
            assertThat(row.items()).isEmpty();
            assertThat(row.reviewReason()).isEqualTo(OutlookResults.BAD_EVIDENCE);
        }
    }

    @Test
    @DisplayName("항목이 없으면 EMPTY, 알 수 없는 상태는 검토 필요")
    void emptyAndUnknownStatus() {
        assertThat(interpret(response("EMPTY")).status()).isEqualTo(OutlookStatus.EMPTY);
        assertThat(interpret(response("GENERATED")).status()).isEqualTo(OutlookStatus.EMPTY);
        OutlookRecord unknown = interpret(response("SOMETHING"));
        assertThat(unknown.status()).isEqualTo(OutlookStatus.REVIEW_NEEDED);
        assertThat(unknown.reviewReason()).isNotBlank();
    }
}
