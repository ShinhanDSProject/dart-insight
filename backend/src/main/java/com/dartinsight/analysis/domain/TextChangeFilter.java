package com.dartinsight.analysis.domain;

import java.util.List;

/**
 * 문장·표 변경 목록의 거르기(2.5·3.7). 모두 맞는 변경만 고른다. null이면 그 조건으로 거르지 않는다.
 *
 * @param types   변경 종류(TextChangeRow.TYPES 안의 값, 겹치지 않음). 그중 하나에 맞으면 맞음(#304). 비었으면 거르지 않는다
 * @param section 최상위 섹션 제목. 그 섹션과 하위 섹션(섹션 경로가 "{section} > "로 시작)의 변경
 * @param q       찾을 글. 변경 전·후 전체 글이나 섹션 경로에 들어 있으면 맞음(대소문자 무시)
 */
public record TextChangeFilter(List<String> types, String section, String q) {

    public TextChangeFilter {
        types = types == null ? List.of() : List.copyOf(types);
    }

    /** 섹션 경로에서 상위·하위 섹션 제목을 잇는 글 */
    public static final String PATH_SEPARATOR = " > ";

    public static final TextChangeFilter NONE = new TextChangeFilter(List.of(), null, null);

    /** 섹션별 건수를 셀 때: 섹션 조건만 뺀다 */
    public TextChangeFilter withoutSection() {
        return new TextChangeFilter(types, null, q);
    }

    /** 유형별 건수를 셀 때: 유형 조건만 뺀다 */
    public TextChangeFilter withoutType() {
        return new TextChangeFilter(List.of(), section, q);
    }
}
