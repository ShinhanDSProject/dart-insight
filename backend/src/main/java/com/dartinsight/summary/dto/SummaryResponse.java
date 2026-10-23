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
     * @param explanationStatus 재무 수치의 설명: FOUND, NOT_FOUND('확인된 설명 없음'), REVIEW_NEEDED
     */
    public record ItemView(int itemNo, String kind, Target target, String factSentence, String aiText,
            boolean aiGenerated, String explanationStatus, List<EvidenceView> evidence, AiInfo ai) {
    }

    /** @param blockedRules 투자 권유성 표현 검사(5.5)에 걸린 규칙 ID. 근거 확인에 실패한 것이면 빈 목록 */
    public record ReviewView(int itemNo, String kind, Target target, String reason, List<String> blockedRules) {
    }
}
