package com.dartinsight.relateddisclosure.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ChangeRelatedDisclosuresTest {

    private static final DisclosureWindow WINDOW = new DisclosureWindow("00126380", LocalDate.of(2025, 6, 30),
            LocalDate.of(2026, 6, 30), LocalDate.of(2026, 8, 14));
    private static final RelatedRun RUN = new RelatedRun(1L, 10L, RelatedDisclosureRules.RULE_VERSION, 5L,
            LocalDate.of(2026, 6, 30), 3, null, LocalDateTime.of(2026, 10, 27, 9, 0));

    private static RelatedLink link(String rceptNo, LocalDate rceptDt, MatchLevel level) {
        WindowDisclosure disclosure = new WindowDisclosure(null, rceptNo, DisclosureDetailType.B001, "보고서", "예시전자",
                rceptDt, null);
        return new RelatedLink(1, disclosure, null, DisclosureTiming.DURING, "RULE", level, null);
    }

    @Test
    @DisplayName("연결은 내용 일치 먼저, 같으면 접수일·접수번호가 최근인 순서이고, 없으면 NOT_FOUND다")
    void foundSortsLinksForScreen() {
        RelatedLink older = link("20260101000001", LocalDate.of(2026, 1, 1), MatchLevel.TYPE_ONLY);
        RelatedLink newer = link("20260301000001", LocalDate.of(2026, 3, 1), MatchLevel.TYPE_ONLY);
        RelatedLink sameDayLater = link("20260301000002", LocalDate.of(2026, 3, 1), MatchLevel.TYPE_ONLY);
        RelatedLink strong = link("20251201000001", LocalDate.of(2025, 12, 1), MatchLevel.STRONG);

        ChangeRelatedDisclosures found = ChangeRelatedDisclosures.found(10L, 7L, WINDOW, RUN,
                List.of(older, newer, strong, sameDayLater), true, false);

        assertThat(found.status()).isEqualTo(RelatedStatus.FOUND);
        assertThat(found.links()).containsExactly(strong, sameDayLater, newer, older);
        assertThat(ChangeRelatedDisclosures.found(10L, 7L, WINDOW, RUN, List.of(), true, false).status())
                .isEqualTo(RelatedStatus.NOT_FOUND);
    }
}
