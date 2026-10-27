package com.dartinsight.relateddisclosure.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.dartinsight.disclosure.domain.DisclosureKeyItems;
import com.dartinsight.disclosure.domain.KeyItemKind;
import com.dartinsight.disclosure.domain.KeyItemStatus;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** 값은 사전 조사(docs/research/3.6-related-disclosure.md 3·4장)의 실제 DS005 응답과 반기보고서 문장이다 */
class KeyItemMatcherTest {

    private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 27, 9, 0);

    private static DisclosureKeyItems keyItems(KeyItemKind kind, Map<String, String> row) {
        return new DisclosureKeyItems("20260101000001", kind, KeyItemStatus.AVAILABLE, kind.items(row), NOW, null);
    }

    private static DisclosureKeyItems capitalIncrease(String newShares) {
        return keyItems(KeyItemKind.CAPITAL_INCREASE, Map.of("nstk_ostk_cnt", newShares, "nstk_estk_cnt", "-"));
    }

    private static List<String> match(DisclosureKeyItems keyItems, String text) {
        return KeyItemMatcher.matchedFields(keyItems, text, "고려아연");
    }

    @Test
    @DisplayName("유상증자는 신주 수가 쉼표가 있든 없든 같은 숫자로 있으면 NEW_SHARES다(에코프로비엠 9,900,990주)")
    void capitalIncreaseMatchesNewShares() {
        DisclosureKeyItems ecoprobm = capitalIncrease("9,900,990");

        assertThat(match(ecoprobm, "보고기간 후 보통주 9,900,990주를 주주배정 후 실권주 일반공모로 발행하였습니다."))
                .containsExactly(KeyItemMatcher.NEW_SHARES);
        assertThat(match(ecoprobm, "신주 9900990주")).containsExactly(KeyItemMatcher.NEW_SHARES);
    }

    @Test
    @DisplayName("유상증자 신주 수가 다른 숫자의 일부이거나 4자리보다 짧으면 일치로 보지 않는다")
    void capitalIncreaseIgnoresPartialOrShortNumbers() {
        assertThat(match(capitalIncrease("9,900,990"), "발행주식 199,009,900주")).isEmpty();
        assertThat(match(capitalIncrease("9,900,990"), "금액 19,900,990천원")).isEmpty();
        assertThat(match(capitalIncrease("500"), "신주 500주")).isEmpty();
    }

    @Test
    @DisplayName("소송은 원고 이름(회사 표시·공백 무시)이 맞을 때만 일치이고, 사건의 명칭(공백 무시)은 그때 함께 남긴다(고려아연 20260108000598, ADR-0032)")
    void litigationMatchesPlaintiffAndCaseName() {
        DisclosureKeyItems lawsuit = keyItems(KeyItemKind.LITIGATION,
                Map.of("icnm", "신주발행무효의 소", "ac_ap", "주식회사 엠제이파트너스"));

        assertThat(match(lawsuit, "(주)엠제이파트너스가 신주발행무효의소를 제기하였습니다."))
                .containsExactly(KeyItemMatcher.PLAINTIFF, KeyItemMatcher.CASE_NAME);
        assertThat(match(lawsuit, "엠제이 파트너스 관련 소송")).containsExactly(KeyItemMatcher.PLAINTIFF);
        assertThat(match(lawsuit, "신주발행무효의 소가 진행 중입니다")).isEmpty();
        assertThat(match(lawsuit, "신주발행금지 가처분")).isEmpty();
    }

    @Test
    @DisplayName("원고가 여럿이면 나눠 보고, 회사 자신은 원고로 대조하지 않는다(고려아연 20250723000226·20251216000384)")
    void litigationSplitsPlaintiffsAndSkipsCompanyItself() {
        DisclosureKeyItems appeal = keyItems(KeyItemKind.LITIGATION,
                Map.of("icnm", "항소", "ac_ap", "고려아연 주식회사"));
        DisclosureKeyItems injunction = keyItems(KeyItemKind.LITIGATION,
                Map.of("icnm", "신주발행금지 가처분", "ac_ap", "주식회사 영풍, 한국기업투자홀딩스 주식회사, 주식회사 와이피씨"));

        assertThat(match(appeal, "고려아연 주식회사는 소송을 진행 중입니다.")).isEmpty();
        // 원고가 회사 자신이면 흔한 사건 명칭('항소')만으로 일치시키지 않는다
        assertThat(match(appeal, "1심 판결에 대해 항소하였습니다.")).isEmpty();
        assertThat(match(injunction, "와이피씨가 제기한 소송")).containsExactly(KeyItemMatcher.PLAINTIFF);
    }

    @Test
    @DisplayName("양수는 발행회사 이름이 글에 있으면 TARGET_COMPANY이고, 글의 '(구: 옛 사명)'으로도 걸린다(미래산업 알로이스)")
    void stockAcquisitionMatchesTargetCompanyIncludingFormerName() {
        DisclosureKeyItems alois = keyItems(KeyItemKind.STOCK_ACQUISITION,
                Map.of("iscmp_cmpnm", "주식회사 알로이스", "dlptn_cmpnm", "신정관, 이시영, 권충식"));

        assertThat(match(alois, "㈜아틀라스링크(구: 알로이스) 지분을 취득하였습니다."))
                .containsExactly(KeyItemMatcher.TARGET_COMPANY);
        assertThat(match(alois, "㈜아틀라스링크 지분을 취득하였습니다.")).isEmpty();
    }

    @Test
    @DisplayName("발행회사 이름에 '(구: …)'가 있으면 옛 사명으로도 대조하고, 영문은 대소문자를 가리지 않는다")
    void stockAcquisitionUsesFormerNameInKeyItems() {
        DisclosureKeyItems renamed = keyItems(KeyItemKind.STOCK_ACQUISITION,
                Map.of("iscmp_cmpnm", "㈜아틀라스링크(구: 알로이스)"));
        DisclosureKeyItems english = keyItems(KeyItemKind.STOCK_ACQUISITION,
                Map.of("iscmp_cmpnm", "Crucible JV LLC"));

        assertThat(match(renamed, "알로이스 지분")).containsExactly(KeyItemMatcher.TARGET_COMPANY);
        assertThat(match(renamed, "아틀라스링크 지분")).containsExactly(KeyItemMatcher.TARGET_COMPANY);
        assertThat(match(english, "계약 상대방 CRUCIBLE JV LLC")).containsExactly(KeyItemMatcher.TARGET_COMPANY);
    }

    @Test
    @DisplayName("옛 사명에 '(주)'가 있어도 대조하고, '구' 뒤에 콜론·공백이 없는 괄호는 옛 사명으로 보지 않는다")
    void formerNameNeedsSeparatorAndSurvivesCompanyMark() {
        DisclosureKeyItems nested = keyItems(KeyItemKind.STOCK_ACQUISITION,
                Map.of("iscmp_cmpnm", "새회사(구: (주)옛회사)"));
        DisclosureKeyItems spaced = keyItems(KeyItemKind.STOCK_ACQUISITION,
                Map.of("iscmp_cmpnm", "아틀라스링크(구 알로이스)"));
        DisclosureKeyItems branch = keyItems(KeyItemKind.STOCK_ACQUISITION,
                Map.of("iscmp_cmpnm", "알로(구로지점)"));

        assertThat(match(nested, "새회사 지분")).containsExactly(KeyItemMatcher.TARGET_COMPANY);
        assertThat(match(nested, "옛회사 지분")).containsExactly(KeyItemMatcher.TARGET_COMPANY);
        assertThat(match(spaced, "알로이스 지분")).containsExactly(KeyItemMatcher.TARGET_COMPANY);
        assertThat(match(branch, "로지점 개설")).isEmpty();
    }

    @Test
    @DisplayName("자료 없음이거나 글이 없거나 대조하지 않는 종류면 일치가 없다(수량을 0으로 만들지 않음)")
    void noDataOrUnsupportedKindHasNoMatch() {
        DisclosureKeyItems noData = new DisclosureKeyItems("20260101000001", KeyItemKind.CAPITAL_INCREASE,
                KeyItemStatus.NO_DATA, List.of(), NOW, null);
        DisclosureKeyItems treasury = keyItems(KeyItemKind.TREASURY_STOCK_ACQUISITION,
                Map.of("aqpln_stk_ostk", "364,698"));

        assertThat(match(noData, "신주 0주")).isEmpty();
        assertThat(match(capitalIncrease("9,900,990"), null)).isEmpty();
        assertThat(match(treasury, "자기주식 364,698주")).isEmpty();
    }
}
