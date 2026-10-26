package com.dartinsight.briefing.domain;

/**
 * ai-server에 보내는 근거 후보 원문 블록 하나.
 *
 * @param evidenceId  근거 ID({@code {접수번호}#B{블록 번호}})
 * @param sectionPath 상위 목차부터 이은 제목
 * @param text        블록 글(2,000자까지)
 */
public record BriefingSource(String evidenceId, BriefingTopic topic, int sectionNo, int blockNo,
        String sectionPath, String text) {
}
