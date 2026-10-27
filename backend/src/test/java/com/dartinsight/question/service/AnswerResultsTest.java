package com.dartinsight.question.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.dartinsight.question.domain.QuestionStatus;
import com.dartinsight.question.dto.AnswerAiResponse;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class AnswerResultsTest {

    private static final Set<String> SENT = Set.of("R#B1", "R#B2");
    private static final Set<String> FACTS = Set.of("F1");

    @Test
    @DisplayName("근거 표시를 확인한 답은 번호로 바꾼 답과 인용한 근거·사실을 남긴다")
    void answeredVerdictKeepsConvertedAnswer() {
        AnswerResults.Verdict verdict = AnswerResults.verdict(response("ANSWERED", "가[R#B2][F1].", null),
                SENT, FACTS);

        assertThat(verdict.status()).isEqualTo(QuestionStatus.ANSWERED);
        assertThat(verdict.answer()).isEqualTo("가[1][F1].");
        assertThat(verdict.evidenceIds()).containsExactly("R#B2");
        assertThat(verdict.factRefs()).containsExactly("F1");
        assertThat(verdict.reviewReason()).isNull();
        assertThat(verdict.blockedRules()).isEmpty();
    }

    @Test
    @DisplayName("보낸 적 없는 근거, 알 수 없는 상태, 사유 없는 검토 필요는 각자의 사유로 검토 필요다")
    void unverifiedAnswersNeedReview() {
        assertThat(AnswerResults.verdict(response("ANSWERED", "가[R#B9].", null), SENT, FACTS))
                .extracting(AnswerResults.Verdict::status, AnswerResults.Verdict::reviewReason)
                .containsExactly(QuestionStatus.REVIEW_NEEDED, AnswerResults.BAD_EVIDENCE);
        assertThat(AnswerResults.verdict(response("MAYBE", null, null), SENT, FACTS).reviewReason())
                .isEqualTo(AnswerResults.UNKNOWN_STATUS);
        assertThat(AnswerResults.verdict(response("REVIEW_NEEDED", null, null), SENT, FACTS).reviewReason())
                .isEqualTo(AnswerResults.NOT_VERIFIED);
    }

    @Test
    @DisplayName("답하지 않은 상태는 답 없이 표현 검사 규칙만 남긴다")
    void outOfScopeKeepsBlockedRules() {
        AnswerResults.Verdict verdict = AnswerResults.verdict(response("OUT_OF_SCOPE", null, List.of("R1")),
                SENT, FACTS);

        assertThat(verdict.status()).isEqualTo(QuestionStatus.OUT_OF_SCOPE);
        assertThat(verdict.answer()).isNull();
        assertThat(verdict.blockedRules()).containsExactly("R1");
    }

    private static AnswerAiResponse response(String status, String answer, List<String> blocked) {
        return new AnswerAiResponse("answer-1", null, "m", "2026-10-01T10:00:00", status, answer, null, null, null,
                blocked, null);
    }
}
