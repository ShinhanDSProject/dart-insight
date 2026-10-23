package com.dartinsight.analysis.domain;

/**
 * 문장·표 변경 목록의 거르기(2.5·3.7). 모두 맞는 변경만 고른다. null이면 그 조건으로 거르지 않는다.
 *
 * @param type    변경 종류(ADDED, DELETED, MODIFIED, REVIEW_NEEDED)
 * @param section 최상위 섹션 제목. 그 섹션과 하위 섹션(섹션 경로가 "{section} > "로 시작)의 변경
 * @param q       찾을 글. 변경 전·후 전체 글이나 섹션 경로에 들어 있으면 맞음(대소문자 무시)
 */
public record TextChangeFilter(String type, String section, String q) {

    /** 섹션 경로에서 상위·하위 섹션 제목을 잇는 글 */
    public static final String PATH_SEPARATOR = " > ";

    public static final TextChangeFilter NONE = new TextChangeFilter(null, null, null);

    /** 섹션별 건수를 셀 때: 섹션 조건만 뺀다 */
    public TextChangeFilter withoutSection() {
        return new TextChangeFilter(type, null, q);
    }

    /** 유형별 건수를 셀 때: 유형 조건만 뺀다 */
    public TextChangeFilter withoutType() {
        return new TextChangeFilter(null, section, q);
    }
}
