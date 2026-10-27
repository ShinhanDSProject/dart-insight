package com.dartinsight.relateddisclosure.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.dartinsight.relateddisclosure.domain.RelatedDisclosureRules.Rule;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/** 제목은 여러 규칙 우선순위 예를 빼면 사전 조사(docs/research/3.6-related-disclosure.md) 2장과 같은 형식의 보고서명이다 */
class RelatedDisclosureRulesTest {

    private static List<String> keys(List<Rule> rules) {
        return rules.stream().map(Rule::key).toList();
    }

    private static String linkedRule(String sectionPath, String text, String reportName) {
        return RelatedDisclosureRules.firstCommon(RelatedDisclosureRules.changeRules(List.of(sectionPath), text),
                RelatedDisclosureRules.titleRules(reportName)).map(Rule::key).orElse(null);
    }

    @Test
    @DisplayName("규칙은 8개이고 버전은 related-3이다")
    void hasEightRulesAndVersion() {
        assertThat(keys(RelatedDisclosureRules.RULES)).containsExactly("litigation", "supply-contract",
                "equity-financing", "debt-financing", "investment", "restructuring", "going-concern", "earnings");
        assertThat(RelatedDisclosureRules.RULE_VERSION).isEqualTo("related-3");
    }

    @ParameterizedTest(name = "{0}: {3}")
    @DisplayName("규칙마다 변경 쪽 낱말과 공시 제목이 같은 규칙에 걸리면 연결한다")
    @CsvSource(delimiter = '|', textBlock = """
            litigation       | XI. 그 밖에 투자자 보호를 위하여 필요한 사항 > 2. 우발부채 등 | 회사는 손해배상 청구를 받았습니다. | 주요사항보고서(소송등의제기)
            litigation       | II. 사업의 내용 > 7. 기타 참고사항 | 1심 판결이 선고되었습니다. | 소송등의판결ㆍ결정
            supply-contract  | II. 사업의 내용 > 4. 매출 및 수주상황 | 해당 사항 없음 | 단일판매ㆍ공급계약체결
            equity-financing | I. 회사의 개요 > 3. 자본금 변동사항 | 제3자배정 유상증자를 하였습니다. | 주요사항보고서(유상증자결정)
            debt-financing   | III. 재무에 관한 사항 > 5. 사채 등의 발행실적 | 해당 사항 없음 | 주요사항보고서(전환사채권발행결정)
            investment       | II. 사업의 내용 > 7. 기타 참고사항 | 신규 법인에 출자하였습니다. | 타법인주식및출자증권취득결정
            restructuring    | II. 사업의 내용 > 1. 사업의 개요 | 해당 사항 없음 | 주요사항보고서(회사분할결정)
            going-concern    | III. 재무에 관한 사항 > 3. 연결재무제표 주석 | 회생 절차 개시를 신청하였습니다. | 회생절차개시신청
            earnings         | III. 재무에 관한 사항 > 2. 연결재무제표 | 영업이익은 1,200억원입니다. | 연결재무제표기준영업(잠정)실적(공정공시)
            """)
    void linksWhenChangeAndTitleShareRule(String rule, String sectionPath, String text, String reportName) {
        assertThat(linkedRule(sectionPath, text, reportName)).isEqualTo(rule);
    }

    @ParameterizedTest(name = "{0}: {3}")
    @DisplayName("규칙마다 한쪽만 걸리거나 사전 조사에서 뺀 제목이면 연결하지 않는다")
    @CsvSource(delimiter = '|', textBlock = """
            litigation       | III. 재무에 관한 사항 > 1. 요약재무정보 | 매출이 늘었습니다. | 주요사항보고서(소송등의제기)
            supply-contract  | III. 재무에 관한 사항 > 1. 요약재무정보 | 매출이 늘었습니다. | 단일판매ㆍ공급계약체결
            equity-financing | I. 회사의 개요 > 3. 자본금 변동사항 | 해당 사항 없음 | 기업설명회(IR)개최
            debt-financing   | III. 재무에 관한 사항 > 5. 사채 등의 발행실적 | 해당 사항 없음 | 주요사항보고서(자기주식취득결정)
            investment       | III. 재무에 관한 사항 > 1. 요약재무정보 | 매출이 늘었습니다. | 유형자산취득결정
            restructuring    | II. 사업의 내용 > 1. 사업의 개요 | 주식을 분할하였습니다. | 주식분할결정
            going-concern    | III. 재무에 관한 사항 > 1. 요약재무정보 | 매출이 늘었습니다. | 회생절차개시신청
            earnings         | IV. 이사의 경영진단 및 분석의견 | 영업이익은 1,200억원입니다. | 현금ㆍ현물배당결정
            """)
    void doesNotLinkWhenOnlyOneSideMatches(String rule, String sectionPath, String text, String reportName) {
        assertThat(linkedRule(sectionPath, text, reportName)).isNull();
    }

    @ParameterizedTest(name = "{0}: {2}")
    @DisplayName("M8 측정에서 엉뚱한 연결을 만들던 넓은 낱말에는 더 걸리지 않는다(ADR-0038)")
    @CsvSource(delimiter = '|', textBlock = """
            litigation       | XI. 그 밖에 투자자 보호를 위하여 필요한 사항 > 2. 우발부채 등에 관한 사항 | 금융기관과의 주요 약정사항은 다음과 같습니다. | 주요사항보고서(소송등의제기)
            supply-contract  | III. 재무에 관한 사항 > 3. 연결재무제표 주석 | 고객과의 계약에서 생기는 수익을 인식합니다. | 단일판매ㆍ공급계약체결
            supply-contract  | II. 사업의 내용 > 6. 주요계약 및 연구개발활동 | 연구개발비용은 다음과 같습니다. | 단일판매ㆍ공급계약체결
            equity-financing | I. 회사의 개요 > 4. 주식의 총수 등 | 자기주식 보유현황 | 주요사항보고서(유상증자결정)
            equity-financing | III. 재무에 관한 사항 > 1. 요약재무정보 | 자본금 2,545,414 | 주요사항보고서(유상증자결정)
            investment       | I. 회사의 개요 > 4. 주식의 총수 등 | 자기주식을 장내에서 취득하였습니다. | 유형자산취득결정
            investment       | III. 재무에 관한 사항 > 3. 연결재무제표 주석 | 투자부동산의 손상차손을 인식하였습니다. | 타법인주식및출자증권취득결정
            earnings         | IV. 이사의 경영진단 및 분석의견 | 영업이익은 1,200억원입니다. | 연결재무제표기준영업(잠정)실적(공정공시)
            earnings         | VIII. 임원 및 직원 등에 관한 사항 > 2. 임원의 보수 등 | 당기순이익 등 재무적 요소로 산정 | 매출액또는손익구조30%(대규모법인은15%)이상변경
            """)
    void narrowWordsNoLongerLink(String rule, String sectionPath, String text, String reportName) {
        assertThat(linkedRule(sectionPath, text, reportName)).isNull();
    }

    @Test
    @DisplayName("실적은 섹션 경로에 '재무제표'가 있을 때만 보고, 다른 규칙에는 섹션 조건이 없다")
    void earningsNeedsFinancialStatementSection() {
        assertThat(keys(RelatedDisclosureRules.changeRules(List.of("III. 재무에 관한 사항 > 5. 재무제표 주석"),
                "당기순이익 16,359"))).containsExactly("earnings");
        assertThat(RelatedDisclosureRules.changeRules(List.of("IV. 이사의 경영진단 및 분석의견"), "영업이익 1,200억원"))
                .isEmpty();
        assertThat(RelatedDisclosureRules.RULES).filteredOn(rule -> !rule.requiredSectionWords().isEmpty())
                .extracting(Rule::key).containsExactly("earnings");
    }

    @Test
    @DisplayName("공백이 섞여도 공백을 뺀 뒤 대조한다")
    void ignoresSpaces() {
        assertThat(keys(RelatedDisclosureRules.changeRules(List.of("II. 사업의 내용 > 4. 매출 및 수주 상황"), "소 제기")))
                .contains("litigation", "supply-contract", "restructuring");
        assertThat(keys(RelatedDisclosureRules.titleRules("[기재정정]주요사항보고서 (소송등의제기)")))
                .containsExactly("litigation");
    }

    @Test
    @DisplayName("한 쌍이 여러 규칙에 걸리면 규칙 순서의 첫 규칙을 남긴다")
    void firstRuleInOrderWins() {
        List<Rule> change = RelatedDisclosureRules.changeRules(List.of("XI. 그 밖에 > 2. 우발부채 등"),
                "합병 관련 소송");
        List<Rule> title = RelatedDisclosureRules.titleRules("합병등종료보고서(소송결과반영)");
        assertThat(keys(title)).containsExactly("litigation", "restructuring");
        assertThat(RelatedDisclosureRules.firstCommon(change, title)).map(Rule::key).hasValue("litigation");
    }

    @Test
    @DisplayName("경로나 글이 없어도 있는 쪽으로 본다")
    void nullPathOrTextIsSkipped() {
        assertThat(keys(RelatedDisclosureRules.changeRules(Arrays.asList(null, "가. 중요한 소송사건"), null)))
                .containsExactly("litigation");
        assertThat(RelatedDisclosureRules.changeRules(Arrays.asList((String) null), null)).isEmpty();
    }

    @Test
    @DisplayName("정정 꼬리표·비고 '정'·'철'을 구분한다")
    void correctionAndRemarks() {
        assertThat(RelatedDisclosureRules.isCorrection("[기재정정]주요사항보고서(유상증자결정)")).isTrue();
        assertThat(RelatedDisclosureRules.isCorrection("[첨부추가][첨부정정]단일판매ㆍ공급계약체결")).isTrue();
        assertThat(RelatedDisclosureRules.isCorrection("주요사항보고서(유상증자결정)")).isFalse();
        assertThat(RelatedDisclosureRules.isCorrection("[첨부추가]주요사항보고서(유상증자결정)")).isFalse();
        assertThat(RelatedDisclosureRules.isCorrected("유정")).isTrue();
        assertThat(RelatedDisclosureRules.isCorrected("유")).isFalse();
        assertThat(RelatedDisclosureRules.isWithdrawn("코철")).isTrue();
        assertThat(RelatedDisclosureRules.isWithdrawn(null)).isFalse();
    }

    @Test
    @DisplayName("규칙마다 기획서의 짝 이름을 화면 이름으로 주고, 사전에 없는 키는 키 그대로 준다")
    void labelsFollowSpecPairNames() {
        assertThat(RelatedDisclosureRules.RULES).extracting(Rule::label).containsExactly(
                "소송", "공급계약", "자본 조달", "빚 조달", "투자", "사업 구조 변경", "존속 위험", "실적");
        assertThat(RelatedDisclosureRules.label("equity-financing")).isEqualTo("자본 조달");
        assertThat(RelatedDisclosureRules.label("removed-rule")).isEqualTo("removed-rule");
    }
}
