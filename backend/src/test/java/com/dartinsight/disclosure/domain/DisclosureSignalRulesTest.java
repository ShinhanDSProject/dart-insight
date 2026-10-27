package com.dartinsight.disclosure.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.dartinsight.disclosure.domain.DisclosureSignalRules.AuditorChange;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * 보고서명은 2026-03-16~31·2026-07-01~09-30 OpenDART 공시검색(거래소공시·주요사항보고서) 실제 응답에서 옮겼다.
 * 감사의견 행은 2026-10-27 accnutAdtorNmNdAdtOpinion.json 실제 응답(레드우즈 20260407001696, 한창 20260326001334,
 * 삼성전자 20260310002820)에서 옮겼다.
 */
class DisclosureSignalRulesTest {

    @ParameterizedTest(name = "{0} → {1}")
    @DisplayName("공시 제목으로 확인해 볼 공시 종류를 정한다")
    @CsvSource(delimiter = '|', value = {
            "최대주주변경|LARGEST_SHAREHOLDER_CHANGE",
            "[기재정정]최대주주변경|LARGEST_SHAREHOLDER_CHANGE",
            "주요사항보고서(유상증자결정)|CAPITAL_INCREASE",
            "[기재정정]주요사항보고서(유상증자결정)|CAPITAL_INCREASE",
            "[기재정정]주요사항보고서(유무상증자결정)|CAPITAL_INCREASE",
            "[기재정정]유상증자결정|CAPITAL_INCREASE",
            "유무상증자결정|CAPITAL_INCREASE",
            "[기재정정]주요사항보고서(전환사채권발행결정)|CONVERTIBLE_BOND",
            "주요사항보고서(신주인수권부사채권발행결정)|BOND_WITH_WARRANT",
            "주요사항보고서(소송등의제기)|LITIGATION",
            "소송등의제기ㆍ신청(경영권분쟁소송)              (이사회결의 효력정지 및 직무집행정지등 가처분)|LITIGATION",
            "소송등의제기ㆍ신청(일정금액이상의청구)|LITIGATION",
            "[기재정정]소송등의제기ㆍ신청(자율공시:일정금액미만의청구)|LITIGATION",
            "[기재정정]주요사항보고서(회생절차개시신청)|REHABILITATION_LISTING",
            "회생절차개시결정|REHABILITATION_LISTING",
            "회생계획인가|REHABILITATION_LISTING",
            "회생절차개시신청기각|REHABILITATION_LISTING",
            "주권매매거래정지기간변경(회생절차개시결정)|REHABILITATION_LISTING",
            "기타시장안내(상장폐지관련)|REHABILITATION_LISTING",
            "주권매매거래정지(상장폐지사유발생)|REHABILITATION_LISTING",
            "기타시장안내('25사업연도감사의견거절관련상장폐지절차미진행)|REHABILITATION_LISTING",
            "기타시장안내(관리종목지정우려종목)              (시가총액 200억원 미달)|REHABILITATION_LISTING",
            "기타시장안내(상장적격성실질심사대상결정)|REHABILITATION_LISTING"})
    void classifiesSignalKindByTitle(String reportName, DisclosureSignalKind expected) {
        assertThat(DisclosureSignalRules.classify(reportName)).contains(expected);
    }

    @ParameterizedTest(name = "{0}")
    @DisplayName("비슷한 낱말이 있어도 정한 종류가 아닌 공시는 넣지 않는다")
    @ValueSource(strings = {
            // 최대주주 변경을 수반하는 계약·지분 공시는 변경 자체의 공시가 아니다
            "[기재정정]최대주주변경을수반하는주식양수도계약체결",
            "최대주주변경을수반하는주식담보제공계약체결",
            "최대주주등소유주식변동신고서(최대주주변경시)",
            "최대주주등소유주식변동신고서",
            // 자회사·종속회사의 일
            "유상증자결정(종속회사의주요경영사항)",
            "[기재정정]주요사항보고서(유상증자결정)(자회사의 주요경영사항)",
            "[기재정정]소송등의제기ㆍ신청(일정금액이상의청구)(자회사의 주요경영사항)",
            // 유상증자 결정 뒤의 진행 공시, 무상증자
            "유상증자최종발행가액확정",
            "유상증자또는주식관련사채등의발행결과(자율공시)",
            "주요사항보고서(무상증자결정)",
            // 사채 취득·매도
            "주요사항보고서(자기전환사채만기전취득결정)",
            "전환사채(해외전환사채포함)발행후만기전사채취득              (제5회차)",
            "주요사항보고서(자기신주인수권부사채만기전취득결정)",
            // 소송 판결은 제기가 아니다
            "소송등의판결ㆍ결정",
            "소송등의판결ㆍ결정(일정금액이상의청구)",
            // 사유가 덧붙인 설명(공백 여러 칸 뒤)에만 있는 공시
            "주권매매거래정지기간변경              (상장적격성 실질심사 대상(사유발생))",
            "감사보고서제출",
            "사업보고서 (2025.12)",
            ""})
    void leavesOutOtherDisclosures(String reportName) {
        assertThat(DisclosureSignalRules.classify(reportName)).isEmpty();
    }

    @Test
    @DisplayName("제목 규칙의 문장은 정해진 사실 문장이고 감사 두 종류는 제목으로 정하지 않는다")
    void titleKindsHaveSentences() {
        for (DisclosureSignalKind kind : DisclosureSignalKind.values()) {
            if (kind.source() == DisclosureSignalKind.Source.DISCLOSURE_LIST) {
                assertThat(kind.sentence()).endsWith("어요.");
            } else {
                assertThat(kind.sentence()).isNull();
            }
        }
        assertThat(DisclosureSignalRules.EXACT_TITLES.values()).doesNotContain(DisclosureSignalKind.AUDITOR_CHANGE,
                DisclosureSignalKind.NON_CLEAN_AUDIT_OPINION);
    }

    @Test
    @DisplayName("이름과 문장에 위험·점수·등급 같은 평가하는 말을 쓰지 않는다")
    void usesNeutralWording() {
        List<String> banned = List.of("위험", "점수", "등급", "주의", "경고", "악재", "호재", "매수", "매도", "저평가", "고평가");
        for (DisclosureSignalKind kind : DisclosureSignalKind.values()) {
            for (String word : banned) {
                assertThat(kind.label()).doesNotContain(word);
                if (kind.sentence() != null) {
                    assertThat(kind.sentence()).doesNotContain(word);
                }
            }
        }
        String audit = DisclosureSignalRules.auditOpinionSentence(new AuditOpinionRow("제16기(당기)", "대주회계법인",
                "의견거절"));
        String auditor = DisclosureSignalRules.auditorChangeSentence(new AuditorChange("제15기(전기)",
                List.of("현대회계법인"), "제16기(당기)", List.of("대주회계법인")));
        for (String word : banned) {
            assertThat(audit).doesNotContain(word);
            assertThat(auditor).doesNotContain(word);
        }
    }

    @ParameterizedTest(name = "{0} → {1}")
    @DisplayName("감사의견에 한정·부적정·거절이 있을 때만 적정이 아님으로 본다")
    @CsvSource(delimiter = '|', nullValues = "NULL", value = {
            "의견거절|true",
            "한정의견|true",
            "부적정의견|true",
            "의견 거절|true",
            "적정의견|false",
            "적정|false",
            "NULL|false",
            "해당사항 없음|false"})
    void decidesNonCleanOpinion(String opinion, boolean expected) {
        assertThat(DisclosureSignalRules.nonClean(opinion)).isEqualTo(expected);
    }

    @Test
    @DisplayName("당기와 전기의 감사인이 다르면 감사인 변경으로 보고 문장에 두 감사인을 적는다")
    void findsAuditorChange() {
        // 레드우즈 20260407001696(연결·별도로 같은 행이 두 번 오지만 저장 전에 한 번만 둠)
        List<AuditOpinionRow> rows = List.of(
                new AuditOpinionRow("제16기(당기)", "대주회계법인", "의견거절"),
                new AuditOpinionRow("제15기(전기)", "현대회계법인", "적정의견"),
                new AuditOpinionRow("제14기(전전기)", "현대회계법인", "적정의견"));

        Optional<AuditorChange> change = DisclosureSignalRules.auditorChange(rows);

        assertThat(change).contains(new AuditorChange("제15기(전기)", List.of("현대회계법인"), "제16기(당기)",
                List.of("대주회계법인")));
        assertThat(DisclosureSignalRules.auditorChangeSentence(change.get()))
                .isEqualTo("사업보고서에 적힌 감사인이 제15기(전기) 현대회계법인에서 제16기(당기) 대주회계법인으로 바뀌었어요.");
        assertThat(DisclosureSignalRules.nonCleanOpinion(rows)).contains(rows.get(0));
        assertThat(DisclosureSignalRules.auditOpinionSentence(rows.get(0)))
                .isEqualTo("사업보고서에 적힌 제16기(당기) 감사의견은 '의견거절'이에요.");
    }

    @Test
    @DisplayName("전전기만 감사인이 달라도 감사인 변경이 아니고, 전기 감사의견만 적정이 아니어도 신호가 아니다")
    void comparesOnlyCurrentAndPriorTerms() {
        // 한창 20260326001334: 당기·전기 삼도회계법인, 전전기 인덕회계법인
        List<AuditOpinionRow> rows = List.of(
                new AuditOpinionRow("제60기(당기)", "삼도회계법인", "적정의견"),
                new AuditOpinionRow("제59기(전기)", "삼도 회계법인", "의견거절"),
                new AuditOpinionRow("제58기(전전기)", "인덕회계법인", "의견거절"));

        assertThat(DisclosureSignalRules.auditorChange(rows)).isEmpty();
        assertThat(DisclosureSignalRules.nonCleanOpinion(rows)).isEmpty();
    }

    @Test
    @DisplayName("어느 기에든 감사인이 없으면 감사인 변경으로 보지 않는다")
    void needsBothAuditors() {
        List<AuditOpinionRow> rows = List.of(
                new AuditOpinionRow("제1기(당기)", "가나회계법인", "적정의견"),
                new AuditOpinionRow("-(전기)", null, null));

        assertThat(DisclosureSignalRules.auditorChange(rows)).isEmpty();
    }

    @Test
    @DisplayName("사업연도 원문의 줄바꿈과 공백을 뺀다")
    void compactsTerm() {
        assertThat(DisclosureSignalRules.compact("제57기 \n(당기)")).isEqualTo("제57기(당기)");
    }

    @Test
    @DisplayName("받침에 따라 조사를 고른다")
    void choosesParticleByFinalConsonant() {
        assertThat(DisclosureSignalRules.auditorChangeSentence(new AuditorChange("제2기(전기)", List.of("가감사반"),
                "제3기(당기)", List.of("나회계"))))
                .endsWith("나회계로 바뀌었어요.");
        assertThat(DisclosureSignalRules.auditOpinionSentence(new AuditOpinionRow("제3기(당기)", "가", "한정")))
                .endsWith("'한정'이에요.");
    }
}
