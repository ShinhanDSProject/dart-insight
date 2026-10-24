package com.dartinsight.question.domain;

import java.time.LocalDateTime;

/**
 * 답 하나의 평가(analysis_question.feedback_*). 평가한 사람은 남기지 않는다.
 *
 * @param reason helpful이 false일 때만. 사유 없이 false일 수도 있다
 * @param at     마지막으로 평가한 시각
 */
public record QuestionFeedback(boolean helpful, FeedbackReason reason, LocalDateTime at) {

    public QuestionFeedback {
        if (helpful && reason != null) {
            throw new IllegalStateException("도움이 된 답에는 사유를 두지 않습니다.");
        }
    }
}
