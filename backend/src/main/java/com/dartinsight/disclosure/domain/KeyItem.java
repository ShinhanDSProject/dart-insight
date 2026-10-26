package com.dartinsight.disclosure.domain;

/**
 * 주요사항보고서 핵심 수치 한 항목(FS-51). 값은 OpenDART 원문 표기 그대로다.
 *
 * @param field OpenDART 응답 필드 이름(근거 위치)
 * @param label 개발가이드의 항목 이름
 * @param unit  개발가이드의 단위(원, 주, %, 원/주). 없으면 null
 */
public record KeyItem(String field, String label, String value, String unit) {
}
