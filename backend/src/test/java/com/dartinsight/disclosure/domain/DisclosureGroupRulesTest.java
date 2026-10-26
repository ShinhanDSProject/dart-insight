package com.dartinsight.disclosure.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/**
 * 공시 묶음 규칙표. 보고서명은 실제 OpenDART 공시검색 응답(삼성전자 2025-10-27~2026-10-26, 전체 시장 2026-10-19~23)에서
 * 그대로 옮겼다(뒤에 덧붙인 설명의 공백도 응답 그대로).
 */
class DisclosureGroupRulesTest {

    @ParameterizedTest(name = "{0} → {1}")
    @DisplayName("실제 보고서명을 묶음으로 나눈다")
    @CsvSource(delimiter = '|', textBlock = """
            반기보고서 (2026.06)                                      | PERIODIC
            사업보고서 (2025.12)                                      | PERIODIC
            분기보고서 (2025.09)                                      | PERIODIC
            [기재정정]사업보고서 (2025.12)                             | PERIODIC
            임원ㆍ주요주주특정증권등소유상황보고서                        | OWNERSHIP
            [기재정정]임원ㆍ주요주주특정증권등소유상황보고서               | OWNERSHIP
            임원ㆍ주요주주특정증권등거래계획보고서                        | OWNERSHIP
            주식등의대량보유상황보고서(일반)                             | OWNERSHIP
            주식등의대량보유상황보고서(약식)                             | OWNERSHIP
            최대주주등소유주식변동신고서                                 | OWNERSHIP
            최대주주변경                                              | OWNERSHIP
            공개매수신고서                                            | OWNERSHIP
            자기주식취득결과보고서                                      | OWNERSHIP
            주요사항보고서(자기주식취득결정)                             | OWNERSHIP
            신탁계약에의한취득상황보고서                                 | OWNERSHIP
            주식소각결정                                              | OWNERSHIP
            주식매수선택권부여에관한신고                                 | OWNERSHIP
            주요사항보고서(유상증자결정)                                 | FUNDING
            주요사항보고서(전환사채권발행결정)                            | FUNDING
            주요사항보고서(신주인수권부사채권발행결정)                      | FUNDING
            교환사채(해외교환사채포함)발행후만기전사채취득                   | FUNDING
            주요사항보고서(자본으로인정되는채무증권발행결정)                 | FUNDING
            주요사항보고서(상각형조건부자본증권발행결정)                    | FUNDING
            증권신고서(지분증권)                                        | FUNDING
            투자설명서(일괄신고)                                        | FUNDING
            일괄신고추가서류(파생결합사채-주가연계파생결합사채)              | FUNDING
            증권발행실적보고서                                          | FUNDING
            소액공모공시서류(지분증권)                                   | FUNDING
            단기차입금증가결정                                          | FUNDING
            전환청구권행사                                             | FUNDING
            전환가액의조정                                             | FUNDING
            대표이사변경                                              | GOVERNANCE
            대표이사(대표집행임원)변경(안내공시)                          | GOVERNANCE
            독립이사의선임ㆍ해임또는중도퇴임에관한신고                      | GOVERNANCE
            주주총회소집결의                                           | GOVERNANCE
            정기주주총회결과                                           | GOVERNANCE
            의결권대리행사권유참고서류                                   | GOVERNANCE
            주요사항보고서(회사합병결정)                                 | GOVERNANCE
            경영권변경등에관한계약체결                                   | GOVERNANCE
            기업지배구조보고서공시                                      | GOVERNANCE
            외국지주회사의자회사편입ㆍ탈퇴                                | GOVERNANCE
            연결재무제표기준영업(잠정)실적(공정공시)                       | BUSINESS
            결산실적공시예고                                           | BUSINESS
            매출액또는손익구조30%(대규모법인은15%)이상변경                 | BUSINESS
            단일판매ㆍ공급계약체결                                      | BUSINESS
            신규시설투자등                                             | BUSINESS
            주요사항보고서(유형자산양수결정)                              | BUSINESS
            타법인주식및출자증권취득결정                                  | BUSINESS
            기업설명회(IR)개최(안내공시)                                | BUSINESS
            투자판단관련주요경영사항                                     | BUSINESS
            장래사업ㆍ경영계획(공정공시)                                 | BUSINESS
            기타경영사항(자율공시)                                      | OTHER
            현금ㆍ현물배당결정                                          | OTHER
            대규모기업집단현황공시[분기별공시(대표회사용)]                  | OTHER
            동일인등출자계열회사와의상품ㆍ용역거래변경                      | OTHER
            특수관계인과의보험거래                                       | OTHER
            감사보고서제출                                             | OTHER
            풍문또는보도에대한해명(미확정)                                | OTHER
            """)
    void classifiesObservedReportNames(String reportName, DisclosureGroup expected) {
        assertThat(DisclosureGroupRules.classify(reportName)).isEqualTo(expected);
    }

    @ParameterizedTest(name = "{0} → {1}")
    @DisplayName("규칙 순서가 앞선 묶음을 쓴다")
    @CsvSource(delimiter = '|', textBlock = """
            임원ㆍ주요주주특정증권등소유상황보고서          | OWNERSHIP
            증권발행실적보고서                            | FUNDING
            주요사항보고서(영업양수결정)                   | GOVERNANCE
            최대주주변경을수반하는주식양수도계약체결          | OWNERSHIP
            주요사항보고서(자기전환사채만기전취득결정)        | FUNDING
            주요사항보고서(자기주식취득신탁계약체결결정)      | OWNERSHIP
            """)
    void earlierRuleWins(String reportName, DisclosureGroup expected) {
        assertThat(DisclosureGroupRules.classify(reportName)).isEqualTo(expected);
    }

    @Test
    @DisplayName("뒤에 덧붙인 설명의 낱말로는 나누지 않는다")
    void ignoresExtraInfoAfterSpaces() {
        assertThat(DisclosureGroupRules.classify("기타경영사항(자율공시)              (소규모합병 승인 이사회 결의(주주총회 갈음) 결과보고)"))
                .isEqualTo(DisclosureGroup.OTHER);
        assertThat(DisclosureGroupRules.classify("[기재정정]연결재무제표기준영업(잠정)실적(공정공시)              "))
                .isEqualTo(DisclosureGroup.BUSINESS);
    }

    @Test
    @DisplayName("앞머리 꼬리표를 여러 개 떼고, 정기보고서는 제목이 보고서 종류로 시작할 때만이다")
    void stripsLeadingTagsAndNeedsPrefixForPeriodic() {
        assertThat(DisclosureGroupRules.title("[기재정정][첨부추가] 반기보고서 (2026.06)")).isEqualTo("반기보고서(2026.06)");
        assertThat(DisclosureGroupRules.classify("[기재정정][첨부추가] 반기보고서 (2026.06)"))
                .isEqualTo(DisclosureGroup.PERIODIC);
        assertThat(DisclosureGroupRules.classify("감사보고서제출")).isEqualTo(DisclosureGroup.OTHER);
    }

    @Test
    @DisplayName("비어 있는 보고서명은 기타다")
    void nullOrBlankIsOther() {
        assertThat(DisclosureGroupRules.classify(null)).isEqualTo(DisclosureGroup.OTHER);
        assertThat(DisclosureGroupRules.classify("   ")).isEqualTo(DisclosureGroup.OTHER);
    }

    @Test
    @DisplayName("기타를 뺀 모든 묶음에 규칙이 있고, 규칙은 묶음 순서대로 놓여 있다")
    void everyGroupHasRulesInDeclaredOrder() {
        Set<DisclosureGroup> covered = DisclosureGroupRules.RULES.stream()
                .map(DisclosureGroupRules.Rule::group).collect(Collectors.toSet());
        assertThat(covered).containsExactlyInAnyOrderElementsOf(Arrays.stream(DisclosureGroup.values())
                .filter(g -> g != DisclosureGroup.OTHER).toList());
        assertThat(DisclosureGroupRules.RULES).extracting(r -> r.group().ordinal()).isSorted();
    }

    @Test
    @DisplayName("12월 결산 사업·반기·분기보고서만 비교할 수 있는 정기보고서로 본다")
    void periodicMeansComparableReport() {
        LocalDate day = LocalDate.of(2026, 8, 14);
        assertThat(new Disclosure("20260814000001", "반기보고서 (2026.06)", "예시전자", day, null).periodic()).isTrue();
        assertThat(new Disclosure("20260814000002", "반기보고서 (2026.09)", "예시전자", day, null).periodic()).isFalse();
        assertThat(new Disclosure("20260814000003", "최대주주변경", "예시전자", day, null).periodic()).isFalse();
    }

    @Test
    @DisplayName("보여 줄 보고서명은 이어진 공백을 한 칸으로 줄인다")
    void displayNameCollapsesSpaces() {
        Disclosure d = new Disclosure("20261020000001", "기타경영사항(자율공시)              (국책과제 선정)", null,
                LocalDate.of(2026, 10, 20), null);
        assertThat(d.displayName()).isEqualTo("기타경영사항(자율공시) (국책과제 선정)");
    }
}
