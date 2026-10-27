package com.dartinsight.analysis.domain;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * 위험 관련 목차 규칙(3.9, FS-61 AC4). 목차 이름은 실제 사업보고서 분석 결과의 섹션 경로
 * (docs/verification/3.6-related-accuracy/*.csv: 삼성전자·고려아연·미래산업 등)에서 옮겼다.
 */
class RiskSectionsTest {

    private static final String OTHER = "XI. 그 밖에 투자자 보호를 위하여 필요한 사항";

    @ParameterizedTest
    @ValueSource(strings = {
        "II. 사업의 내용 > 5. 위험관리 및 파생거래",
        OTHER + " > 2. 우발부채 등에 관한 사항",
        OTHER + " > 2. 우발부채 등에 관한 사항 > 가. 중요한 소송사건",
        OTHER + " > 3. 제재 등과 관련된 사항",
        "XI. 그 밖에 > 2. 우발부채 등",
        // 삼성전자 2025 사업보고서(20260310002820) 원문 목차
        "IV. 이사의 경영진단 및 분석의견 > 1. 예측정보에 대한 주의사항",
    })
    @DisplayName("위험관리·파생거래·예측정보·우발부채·소송·제재 목차는 위험 관련이다")
    void matchesRiskSections(String path) {
        assertThat(RiskSections.matches(path)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "I. 회사의 개요 > 1. 회사의 개요",
        "II. 사업의 내용 > 1. 사업의 개요",
        "II. 사업의 내용 > 4. 매출 및 수주상황",
        "II. 사업의 내용 > 6. 주요계약 및 연구개발활동",
        "III. 재무에 관한 사항 > 3. 연결재무제표 주석",
        "X. 대주주 등과의 거래내용",
        OTHER + " > 1. 공시내용 진행 및 변경사항",
        OTHER + " > 4. 작성기준일 이후 발생한 주요사항 등 기타사항",
    })
    @DisplayName("그 밖의 목차는 같은 대목차(투자자 보호) 아래여도 위험 관련이 아니다")
    void doesNotMatchOtherSections(String path) {
        assertThat(RiskSections.matches(path)).isFalse();
    }

    @Test
    @DisplayName("공백을 빼고 비교한다")
    void ignoresSpaces() {
        assertThat(RiskSections.matches("II. 사업의 내용 > 5. 위험 관리 및 파생 거래")).isTrue();
    }

    @Test
    @DisplayName("이전·현재 경로 중 하나라도 위험 관련이면 위험 관련이고, 경로가 없으면 아니다")
    void matchesEitherPath() {
        assertThat(RiskSections.isRiskRelated("II. 사업의 내용 > 7. 기타 참고사항",
                "II. 사업의 내용 > 5. 위험관리 및 파생거래")).isTrue();
        assertThat(RiskSections.isRiskRelated(OTHER + " > 3. 제재 등과 관련된 사항", null)).isTrue();
        assertThat(RiskSections.isRiskRelated("II. 사업의 내용 > 1. 사업의 개요", null)).isFalse();
        assertThat(RiskSections.isRiskRelated(null, null)).isFalse();
    }
}
