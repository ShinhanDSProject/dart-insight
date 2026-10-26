package com.dartinsight.question.dto;

import com.dartinsight.question.domain.FeedbackReason;
import com.dartinsight.question.domain.QuestionFact;
import com.dartinsight.question.domain.QuestionFeedback;
import com.dartinsight.question.domain.QuestionRecord;
import com.dartinsight.question.domain.QuestionStatus;
import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 질문 하나와 답(docs/api-spec.md POST·GET /api/analyses/{analysisId}/questions).
 *
 * @param answer    답. 문장 안의 [1]은 citations[].no, [F1]은 facts[].ref. ANSWERED가 아니면 null
 * @param message   답이 없을 때의 안내. ANSWERED면 null
 * @param citations 답이 인용한 원문(번호 순서)
 * @param facts       답이 인용한 사실(코드가 계산)
 * @param aiGenerated answer가 AI가 만든 문장이면 true(ANSWERED). 화면은 이 값으로 'AI 생성'을 표시한다(5.6)
 * @param ai          AI가 답을 만들었을 때만
 * @param feedback  답 평가. 평가하지 않았으면 null
 */
public record QuestionResponse(Long questionId, String question, QuestionStatus status, String answer,
        String message, List<Citation> citations, List<Fact> facts, boolean aiGenerated, AiInfo ai, Feedback feedback,
        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss") LocalDateTime createdAt) {

    public static QuestionResponse of(QuestionRecord row, List<Citation> citations, List<QuestionFact> facts) {
        boolean answered = row.status() == QuestionStatus.ANSWERED;
        return new QuestionResponse(row.id(), row.question(), row.status(), answered ? row.answer() : null,
                row.status().message(), answered ? citations : List.of(),
                answered ? facts.stream().map(Fact::from).toList() : List.of(), answered,
                answered && row.model() != null ? new AiInfo(row.model(), row.promptVersion(), row.generatedAt())
                        : null,
                row.feedback() == null ? null : Feedback.from(row.feedback()), row.createdAt());
    }

    /**
     * 인용한 원문 위치.
     *
     * @param side  current·previous
     * @param quote 문단 앞 160자
     */
    public record Citation(int no, String evidenceId, String side, String rceptNo, String reportName,
            Integer sectionNo, Integer blockNo, String sectionPath, String quote) {
    }

    public record Fact(String ref, Long changeId, String sjDiv, String accountName, String sentence) {

        static Fact from(QuestionFact fact) {
            return new Fact(fact.ref(), fact.changeId(), fact.sjDiv(), fact.accountName(), fact.sentence());
        }
    }

    /** 답 평가. reason은 helpful이 false일 때만 */
    public record Feedback(boolean helpful, FeedbackReason reason) {

        static Feedback from(QuestionFeedback feedback) {
            return new Feedback(feedback.helpful(), feedback.reason());
        }
    }

    public record AiInfo(String model, String promptVersion,
            @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss") LocalDateTime generatedAt) {
    }
}
