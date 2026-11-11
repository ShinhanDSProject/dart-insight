package com.dartinsight.activity.dto;

import java.util.List;

/** AI 서버 두 보고서 사이 활동 요청(POST /internal/period-activities, docs/api-spec.md 3장, ADR-0067). */
public record ActivityAiRequest(String promptVersion, String companyName, String previousReportName,
        String currentReportName, String periodFrom, String periodTo, List<Financial> financials,
        List<Disclosure> disclosures, List<Change> changes) {

    /** @param text 코드가 계산한 재무 수치 문장(ADR-0068) */
    public record Financial(String evidenceId, String text) {
    }

    /** @param text 공시 원문 글. 받지 못하면 빈 글 */
    public record Disclosure(String evidenceId, String rceptDt, String reportName, String text) {
    }

    /**
     * @param previousEvidenceId 이전 글의 원문 위치(`{접수번호}#B{블록 번호}`). 이전 글이 없으면 null
     * @param currentEvidenceId  이번 글의 원문 위치. 이번 글이 없으면 null
     */
    public record Change(int changeNo, String changeType, String blockType, String listGroup, String field,
            boolean raisedFromNote, String sectionPath, String previousEvidenceId, String currentEvidenceId,
            String previousText, String currentText) {
    }
}
