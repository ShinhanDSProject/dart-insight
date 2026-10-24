package com.dartinsight.question.domain;

import java.util.Arrays;
import java.util.Optional;

/** 답이 도움이 안 된 사유(docs/api-spec.md PUT …/questions/{questionId}/feedback). 이름이 곧 API·DB 값이다 */
public enum FeedbackReason {
    /** 근거가 안 맞아요 */
    WRONG_SOURCE,
    /** 질문에 답하지 않았어요 */
    NOT_ANSWERED,
    /** 이해하기 어려워요 */
    HARD_TO_READ,
    /** 기타 */
    OTHER;

    /** API·DB 값으로 찾는다. 모르는 값이면 빈 값 */
    public static Optional<FeedbackReason> find(String value) {
        return Arrays.stream(values()).filter(r -> r.name().equals(value)).findFirst();
    }
}
