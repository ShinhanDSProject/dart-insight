package com.dartinsight.glossary.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class GlossaryTermsTest {

    private static final LocalDate REVIEWED = LocalDate.of(2026, 11, 10);
    private static final List<GlossarySource> SOURCE = List.of(new GlossarySource("자료", "https://example.test"));

    private static GlossaryTerm card(String key, String term, List<String> aliases, List<String> related,
            List<GlossarySource> sources, LocalDate reviewedAt) {
        return new GlossaryTerm(key, GlossaryLevel.CORE, term, aliases, term + "의 뜻", null, null, null, related,
                null, sources, "검토자", reviewedAt);
    }

    private static GlossaryTerm reviewed(String key, String term, String... related) {
        return card(key, term, List.of(), List.of(related), SOURCE, REVIEWED);
    }

    @Test
    @DisplayName("출처 주소나 검토일이 없는 카드는 내보내지 않는다")
    void publishesOnlyCardsWithCompleteSourcesAndReviewDate() {
        GlossaryTerms terms = GlossaryTerms.of(List.of(
                reviewed("asset", "자산"),
                card("noDate", "검토일 없음", List.of(), List.of(), SOURCE, null),
                card("noSource", "출처 없음", List.of(), List.of(), List.of(), REVIEWED),
                card("noUrl", "주소 없음", List.of(), List.of(), List.of(new GlossarySource("자료", null)), REVIEWED)));

        assertThat(terms.published()).extracting(GlossaryTerm::key).containsExactly("asset");
        assertThat(terms.all()).hasSize(4);
    }

    @Test
    @DisplayName("내보내지 않는 카드를 가리키는 관련 용어는 목록에서 뺀다")
    void dropsRelatedKeysOfUnpublishedCards() {
        GlossaryTerms terms = GlossaryTerms.of(List.of(
                reviewed("debtRatio", "부채비율", "asset", "draft"),
                reviewed("asset", "자산"),
                card("draft", "검토 전", List.of(), List.of(), SOURCE, null)));

        assertThat(terms.published().get(0).related()).containsExactly("asset");
    }

    @Test
    @DisplayName("카드 키가 겹치면 만들지 않는다")
    void rejectsDuplicateKeys() {
        assertThatThrownBy(() -> GlossaryTerms.of(List.of(reviewed("asset", "자산"), reviewed("asset", "자산2"))))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("키가 겹칩니다");
    }

    @Test
    @DisplayName("공백을 빼고 같은 용어·별칭이 두 카드에 있으면 만들지 않는다")
    void rejectsDuplicateNamesIgnoringSpaces() {
        GlossaryTerm debt = card("debtRatio", "부채비율", List.of(), List.of(), SOURCE, REVIEWED);
        GlossaryTerm other = card("other", "다른 용어", List.of("부채 비율"), List.of(), SOURCE, REVIEWED);

        assertThatThrownBy(() -> GlossaryTerms.of(List.of(debt, other)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("이름이 겹칩니다");
    }

    @Test
    @DisplayName("탭·줄 없는 공백(NBSP)이 섞여도 같은 이름으로 보고 다른 카드와 겹치면 만들지 않는다")
    void rejectsDuplicateNamesWithTabsAndNoBreakSpaces() {
        GlossaryTerm debt = card("debtRatio", "부채비율", List.of(), List.of(), SOURCE, REVIEWED);
        GlossaryTerm tab = card("tab", "다른 용어", List.of("부채\t비율"), List.of(), SOURCE, REVIEWED);
        GlossaryTerm noBreak = card("noBreak", "또 다른 용어", List.of("부채\u00A0비율"), List.of(), SOURCE, REVIEWED);

        assertThat(GlossaryTerms.normalizeName("부채\t\u00A0\u3000비율")).isEqualTo("부채비율");
        assertThatThrownBy(() -> GlossaryTerms.of(List.of(debt, tab))).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> GlossaryTerms.of(List.of(debt, noBreak))).isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("같은 카드 안에서 띄어쓰기만 다른 별칭은 허용한다")
    void allowsSpacingAliasWithinSameCard() {
        GlossaryTerm debt = card("debtRatio", "부채비율", List.of("부채 비율"), List.of(), SOURCE, REVIEWED);

        assertThat(GlossaryTerms.of(List.of(debt)).published()).hasSize(1);
    }

    @Test
    @DisplayName("관련 용어가 없는 카드나 자기 자신을 가리키면 만들지 않는다")
    void rejectsUnknownOrSelfRelated() {
        assertThatThrownBy(() -> GlossaryTerms.of(List.of(reviewed("asset", "자산", "missing"))))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("missing");
        assertThatThrownBy(() -> GlossaryTerms.of(List.of(reviewed("asset", "자산", "asset"))))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("키·수준·용어·한 줄 뜻이 비어 있으면 만들지 않는다")
    void rejectsMissingRequiredFields() {
        GlossaryTerm noDefinition = new GlossaryTerm("asset", GlossaryLevel.BASIC, "자산", null, " ", null, null,
                null, null, null, null, null, null);

        assertThatThrownBy(() -> GlossaryTerms.of(List.of(noDefinition)))
                .isInstanceOf(IllegalStateException.class);
    }
}
