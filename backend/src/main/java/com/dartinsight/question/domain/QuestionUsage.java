package com.dartinsight.question.domain;

import java.util.Collections;
import java.util.EnumMap;
import java.util.Map;

/**
 * 한 기간의 질문 집계(AI 사용 현황, FS-15). 질문 본문은 담지 않는다.
 *
 * @param byStatus 상태별 질문 수(모든 상태가 enum 순서로 키에 있고, 없으면 0)
 * @param helpful 도움이 됐다고 평가한 질문 수
 * @param notHelpful 도움이 안 됐다고 평가한 질문 수
 * @param reasons 도움이 안 된 사유별 수(모든 사유가 키에 있고, 없으면 0). 사유 없이 한 평가는 세지 않는다
 */
public record QuestionUsage(Map<QuestionStatus, Long> byStatus, long helpful, long notHelpful,
        Map<FeedbackReason, Long> reasons) {

    public QuestionUsage {
        byStatus = Collections.unmodifiableMap(new EnumMap<>(byStatus));
        reasons = Collections.unmodifiableMap(new EnumMap<>(reasons));
    }
}
