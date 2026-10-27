package com.dartinsight.outlook.domain;

/**
 * 회사가 밝힌 전망·계획 항목 하나와 그 근거 위치. company_outlook.items에 JSON 배열로 저장한다(docs/erd.md).
 *
 * @param summary  AI가 줄인 요지
 * @param quote    원문 글 그대로(이어진 공백은 한 칸)
 * @param evidence quote가 든 원문 위치
 */
public record OutlookItem(OutlookCategory category, String summary, String quote, Evidence evidence) {

    /** quote가 든 원문 위치 */
    public record Evidence(String evidenceId, String rceptNo, int sectionNo, int blockNo, String sectionPath) {

        public static Evidence of(String rceptNo, OutlookSource source) {
            return new Evidence(source.evidenceId(), rceptNo, source.sectionNo(), source.blockNo(),
                    source.sectionPath());
        }
    }
}
