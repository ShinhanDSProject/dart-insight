package com.dartinsight.briefing.dto;

import java.util.List;

/** AI 서버 브리핑 요청(POST /internal/briefings). docs/api-spec.md 3절 */
public record BriefingAiRequest(String promptVersion, String companyName, String reportName, List<Source> sources) {

    /** 근거 후보 블록. topic은 OVERVIEW·PRODUCTS·SALES·RISK */
    public record Source(String evidenceId, String topic, String sectionPath, String text) {
    }
}
