package com.dartinsight.summary.dto;

import com.dartinsight.analysis.domain.TextStatus;
import com.dartinsight.summary.domain.SummaryItemRow;
import com.dartinsight.summary.domain.SummaryStatus;
import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalDateTime;
import java.util.List;

public record SummaryResponse(Long analysisId, SummaryStatus summaryStatus, String summaryMessage,
        TextStatus textStatus, List<ItemView> items, int reviewNeededCount, List<ReviewView> reviewNeeded) {

    /** @param type FINANCIAL(재무 수치 탭의 계정) 또는 TEXT(문장 변화 탭의 변경) */
    public record Target(String type, Long changeId, String sjDiv) {
    }

    /** @param side current·previous. 분석의 보고서가 아니면 null(화면은 근거로 쓰지 않음) */
    public record EvidenceView(String evidenceId, String side, String rceptNo, Integer sectionNo, Integer blockNo) {
    }

    public record AiInfo(String model, String promptVersion,
            @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss") LocalDateTime generatedAt) {

        /** AI가 만든 문장이 없으면 null */
        public static AiInfo from(SummaryItemRow row) {
            return row.aiGenerated() ? new AiInfo(row.model(), row.promptVersion(), row.generatedAt()) : null;
        }
    }

    /**
     * 요약 한 줄.
     *
     * @param factSentence      코드가 만든 사실 문장(재무 수치). 문장 변화면 null
     * @param aiText            AI가 만든 문장(문장 변화 요약, 재무 수치 설명). 없으면 null
     * @param explanationStatus 재무 수치의 설명: FOUND, NOT_FOUND('확인된 설명 없음'), TEMPLATE(#149), REVIEW_NEEDED
     * @param explanationGrade  재무 수치 설명 등급(ADR-0015): STATED, RELATED, NONE. 문장 변화·TEMPLATE·REVIEW_NEEDED·등급 기능
     *                          전이면 null
     * @param quote             후보 원문에서 그대로 옮긴 인용문. 없으면 null
     * @param quoteEvidence     인용 위치. 없으면 null
     * @param gradeReason       코드가 설명 등급을 낮춘 사유. 낮추지 않았으면 null
     */
    public record ItemView(int itemNo, String kind, Target target, String factSentence, String aiText,
            boolean aiGenerated, String explanationStatus, String explanationGrade, String quote,
            EvidenceView quoteEvidence, String gradeReason, List<EvidenceView> evidence, AiInfo ai) {

        /** 요약에 보이는 줄. reviewReason은 설명이 검토 필요가 아닐 때만 코드가 설명 등급을 낮춘 사유다 */
        public static ItemView of(int itemNo, Target target, SummaryItemRow row, EvidenceView quoteEvidence,
                List<EvidenceView> evidence) {
            String gradeReason = row.explanationReviewNeeded() ? null : row.reviewReason();
            return new ItemView(itemNo, row.kind(), target, row.factSentence(), row.aiText(), row.aiGenerated(),
                    row.explanationStatus(), row.explanationGrade(), row.quote(), quoteEvidence, gradeReason,
                    evidence, AiInfo.from(row));
        }
    }

    /** @param blockedRules 투자 권유성 표현 검사(5.5)에 걸린 규칙 ID. 근거 확인에 실패한 것이면 빈 목록 */
    public record ReviewView(int itemNo, String kind, Target target, String reason, List<String> blockedRules) {

        /** 근거·숫자 확인을 통과하지 못해 요약에서 뺀 줄 */
        public static ReviewView of(int itemNo, Target target, SummaryItemRow row) {
            return new ReviewView(itemNo, row.kind(), target, row.reviewReason(), row.blockedRules());
        }

        /**
         * 수치 문장은 보이고 설명만 검토 필요인 재무 수치. 템플릿(#149)은 근거 말고도 원인·투자 권유 표현 등으로 실패하므로
         * 검증 실패로만 알리고, 인용이 있으면 그것만 보인다고 알린다
         */
        public static ReviewView ofExplanation(int itemNo, Target target, SummaryItemRow row) {
            String lead;
            if (!SummaryItemRow.TEMPLATE.equals(row.explanationStatus())) {
                lead = "설명의 근거를 확인하지 못했어요. ";
            } else if (row.quote() == null) {
                lead = "AI 설명이 검증을 통과하지 못했어요. ";
            } else {
                lead = "AI 설명이 검증을 통과하지 못해 원문 인용만 보여 줘요. ";
            }
            return new ReviewView(itemNo, row.kind(), target,
                    lead + (row.reviewReason() == null ? "" : row.reviewReason()), row.blockedRules());
        }
    }
}
