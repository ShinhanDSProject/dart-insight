package com.dartinsight.outlook.dto;

import com.dartinsight.outlook.domain.OutlookSource;
import java.util.List;

/** AI 서버 전망·계획 요청(POST /internal/outlooks). docs/api-spec.md 3절 */
public record OutlookAiRequest(String promptVersion, String companyName, String reportName, List<Source> sources) {

    public static OutlookAiRequest of(String promptVersion, String companyName, String reportName,
            List<OutlookSource> sources) {
        return new OutlookAiRequest(promptVersion, companyName, reportName, sources.stream()
                .map(s -> new Source(s.evidenceId(), s.sectionPath(), s.text())).toList());
    }

    /** 근거 후보 문단 */
    public record Source(String evidenceId, String sectionPath, String text) {
    }
}
