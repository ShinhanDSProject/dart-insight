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

    @Test
    @DisplayName("용어·별칭으로 내보낼 수 있는 카드를 찾는다(공백·영문 대소문자 무시). 검토 전 카드는 findAny로만 찾는다")
    void findsCardsByNameIgnoringSpacesAndCase() {
        GlossaryTerm cb = card("convertibleBond", "전환사채", List.of("CB"), List.of(), SOURCE, REVIEWED);
        GlossaryTerm draft = card("draft", "자본잠식", List.of(), List.of(), SOURCE, null);
        GlossaryTerms terms = GlossaryTerms.of(List.of(cb, draft));

        assertThat(terms.findPublished("cb")).map(GlossaryTerm::key).hasValue("convertibleBond");
        assertThat(terms.findPublished(" 전환 사채 ")).map(GlossaryTerm::key).hasValue("convertibleBond");
        assertThat(terms.findPublished("자본잠식")).isEmpty();
        assertThat(terms.findAny("자본잠식")).map(GlossaryTerm::key).hasValue("draft");
        assertThat(terms.findPublished(" ")).isEmpty();
    }

    @Test
    @DisplayName("비슷한 카드는 이름을 품는 카드를 먼저, 그다음 글자 조각이 많이 겹치는 순서로 최대 limit개, 검토 전 카드는 빼고 고른다")
    void picksSimilarPublishedCards() {
        GlossaryTerms terms = GlossaryTerms.of(List.of(
                reviewed("debtRatio", "부채비율"),
                reviewed("debt", "부채"),
                reviewed("asset", "자산"),
                card("draft", "부채상환", List.of(), List.of(), SOURCE, null)));

        assertThat(terms.similarPublished("부채율", 3)).extracting(GlossaryTerm::key)
                .containsExactly("debt", "debtRatio");
        assertThat(terms.similarPublished("부채율", 1)).extracting(GlossaryTerm::key).containsExactly("debt");
        assertThat(terms.similarPublished("배당", 3)).isEmpty();
        assertThat(GlossaryTerms.similarity("부채율", "부채비율")).isEqualTo(0.4);
    }

    @Test
    @DisplayName("짧은 글이 긴 이름에 들어 있기만 하면 1이 되지 않고 길이 비율로 본다(한 글자는 겹침으로 보지 않음)")
    void containmentScoresByLengthRatio() {
        GlossaryTerms terms = GlossaryTerms.of(List.of(
                reviewed("debtRatio", "부채비율"),
                reviewed("asset", "자산"),
                reviewed("totalAssets", "자산총계"),
                reviewed("assetImpairment", "유형자산손상차손")));

        assertThat(GlossaryTerms.similarity("자산", "자산")).isEqualTo(1.0);
        assertThat(GlossaryTerms.similarity("자산", "자산총계")).isEqualTo(0.5);
        assertThat(GlossaryTerms.similarity("자산", "유형자산손상차손")).isEqualTo(0.25);
        assertThat(GlossaryTerms.similarity("채", "부채비율")).isZero();
        // 짧은 글로 찾아도 들어 있기만 한 긴 카드는 고르지 않고, 길이가 비슷한 카드를 먼저 고른다
        assertThat(terms.similarPublished("자산들", 3)).extracting(GlossaryTerm::key)
                .containsExactly("asset", "totalAssets");
        assertThat(terms.similarPublished("채", 3)).isEmpty();
    }
}
