package com.dartinsight.document;

/**
 * 원문 목차(섹션) 하나. 번호는 문서 순서대로 1부터.
 *
 * @param parentNo  상위 섹션 번호. 대목차면 null
 * @param depth     SECTION-n의 n(대목차 1). 목차 밖 본문은 0
 * @param sourceRef 원문 TITLE의 위치 표시(AASSOCNOTE). 없으면 null
 * @param cover     표지인지
 */
public record DocumentSection(int sectionNo, Integer parentNo, int depth, String title, String sourceRef,
        boolean cover, int blockCount) {
}
