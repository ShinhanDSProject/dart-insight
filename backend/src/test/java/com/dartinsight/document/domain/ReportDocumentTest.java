package com.dartinsight.document.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.dartinsight.document.dto.StructuredDocumentResponse;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ReportDocumentTest {

    private static final String RCEPT_NO = "20250814000001";
    private static final LocalDateTime FETCHED = LocalDateTime.of(2026, 10, 21, 9, 0);

    private static ReportDocument structured(String parserVersion, LocalDateTime structuredAt) {
        StructuredDocumentResponse response = new StructuredDocumentResponse(RCEPT_NO, parserVersion, "STRUCTURED",
                null, null, null, null, null, null, List.of(), List.of(), Map.of(), List.of());
        return ReportDocument.structured(RCEPT_NO, response, 10, FETCHED, structuredAt);
    }

    @Test
    @DisplayName("원문 없음으로 남긴 기록은 목록에서 보고서를 다시 볼 때까지 그대로 쓴다")
    void unavailableUntilReportIsSeenAgain() {
        ReportDocument document = ReportDocument.notAvailable(RCEPT_NO, "013", "자료 없음", FETCHED);

        assertThat(document.fileReceived()).isFalse();
        assertThat(document.unavailableSince(FETCHED)).isTrue();
        assertThat(document.unavailableSince(FETCHED.plusMinutes(1))).isFalse();
        assertThat(document.structuredWith(null)).isFalse();
    }

    @Test
    @DisplayName("같은 파서 버전으로 구조화한 원문만 다시 쓰고, 분석 뒤에 다시 구조화했는지 알려 준다")
    void structuredWithParserVersionAndRestructuredAfter() {
        ReportDocument document = structured("p1", FETCHED.plusHours(1));

        assertThat(document.fileReceived()).isTrue();
        assertThat(document.unavailableSince(FETCHED)).isFalse();
        assertThat(document.structuredWith("p1")).isTrue();
        assertThat(document.structuredWith("p2")).isFalse();
        assertThat(document.restructuredAfter(FETCHED)).isTrue();
        assertThat(document.restructuredAfter(FETCHED.plusHours(2))).isFalse();
        assertThat(document.restructuredAfter(null)).isFalse();
    }
}
