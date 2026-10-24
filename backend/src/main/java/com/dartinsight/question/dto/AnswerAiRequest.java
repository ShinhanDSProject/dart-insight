package com.dartinsight.question.dto;

import java.util.List;

/** AI 서버 답 요청(POST /internal/answers). docs/api-spec.md 3절 */
public record AnswerAiRequest(String companyName, String previousReport, String currentReport, String question,
        List<Fact> facts, List<Source> sources) {

    /** 코드가 만든 사실 문장 */
    public record Fact(String ref, String sentence) {
    }

    /** 후보 문단. side는 current·previous */
    public record Source(String evidenceId, String side, String sectionPath, String text) {
    }
}
