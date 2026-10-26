package com.dartinsight.briefing.domain;

import java.util.List;

/**
 * 브리핑 문장 하나와 그 근거. company_briefing.sentences에 JSON 배열로 저장한다(docs/erd.md).
 *
 * @param evidence 문장이 인용한 원문 위치(하나 이상)
 */
public record BriefingSentence(String text, List<Evidence> evidence) {

    /**
     * 인용한 원문 위치.
     *
     * @param quote 인용 블록 글 앞 600자(만든 때의 원문)
     */
    public record Evidence(String evidenceId, int sectionNo, int blockNo, String sectionPath, String quote) {
    }
}
