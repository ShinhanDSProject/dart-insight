package com.dartinsight.analysis.domain;

/**
 * 최상위 섹션 하나와 그 안(하위 섹션 포함)의 변경 건수(3.7).
 *
 * @param title 섹션 경로의 첫 제목(예: "II. 사업의 내용")
 * @param count 거르기에 맞는 건수. 0일 수 있다
 */
public record TextSectionCount(String title, int count) {
}
