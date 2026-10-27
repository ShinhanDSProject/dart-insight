package com.dartinsight.analysis.domain;

import java.util.List;

/**
 * 위험 관련 목차 규칙(3.9 위험 요인 변화, FS-61). 문장 변경의 섹션 경로(이전·현재 중 하나라도)의 목차 제목에
 * {@link #KEYWORDS} 낱말이 들어 있으면 위험 관련이다. 공백은 빼고 비교한다.
 *
 * <p>낱말은 실제 사업보고서 목차(docs/verification/3.6-related-accuracy/*.csv의 섹션 경로)에서 골랐다:
 * 'II. 사업의 내용 > 5. 위험관리 및 파생거래', 'XI. 그 밖에 투자자 보호를 위하여 필요한 사항 > 2. 우발부채 등에 관한 사항'
 * (그 아래 '가. 중요한 소송사건' 등), 'XI. … > 3. 제재 등과 관련된 사항'. XI의 다른 항목(공시내용 진행 및 변경사항,
 * 작성기준일 이후 발생한 주요사항)은 위험 목차가 아니라서 '투자자 보호'로는 고르지 않는다.
 *
 * <p>목차 제목으로 나눈 것이라 실제 내용과 다를 수 있다. 위험의 크기·좋고 나쁨은 판단하지 않는다.
 */
public final class RiskSections {

    /** 목차 제목에 들어 있으면 위험 관련인 낱말(공백 없음). SQL 거르기(TextChangeStore)도 이 목록을 쓴다 */
    public static final List<String> KEYWORDS = List.of("위험", "파생거래", "우발", "소송", "제재");

    /** 비교할 때 빼는 공백(SQL 쪽도 같은 글자를 뺀다) */
    public static final String SPACE = " ";

    private RiskSections() {
    }

    /** 섹션 경로 중 하나라도 위험 관련 목차인지. null 경로는 건너뛴다 */
    public static boolean isRiskRelated(String sectionPath, String previousSectionPath) {
        return matches(sectionPath) || matches(previousSectionPath);
    }

    /** 섹션 경로 하나가 위험 관련 목차인지 */
    public static boolean matches(String path) {
        if (path == null) {
            return false;
        }
        String compact = compact(path);
        return KEYWORDS.stream().anyMatch(compact::contains);
    }

    private static String compact(String path) {
        return path.replace(SPACE, "");
    }
}
