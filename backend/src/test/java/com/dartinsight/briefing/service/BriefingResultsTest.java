package com.dartinsight.briefing.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.dartinsight.briefing.domain.BriefingRecord;
import com.dartinsight.briefing.domain.BriefingSource;
import com.dartinsight.briefing.domain.BriefingStatus;
import com.dartinsight.briefing.domain.BriefingTopic;
import com.dartinsight.briefing.dto.BriefingAiResponse;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class BriefingResultsTest {

    private static final List<BriefingSource> SOURCES = List.of(
            new BriefingSource("R#B1", BriefingTopic.OVERVIEW, 3, 1, "II. 사업의 내용", "반도체를 만든다."));

    @Test
    @DisplayName("근거를 확인한 문장은 인용 글과 함께 GENERATED로 남긴다")
    void verifiedSentencesAreGenerated() {
        BriefingRecord row = interpret(response("GENERATED", new BriefingAiResponse.Sentence(" 반도체 회사다. ",
                List.of("R#B1", "R#B1"))));

        assertThat(row.status()).isEqualTo(BriefingStatus.GENERATED);
        assertThat(row.reviewReason()).isNull();
        assertThat(row.sentences()).hasSize(1);
        assertThat(row.sentences().get(0).text()).isEqualTo("반도체 회사다.");
        assertThat(row.sentences().get(0).evidence()).singleElement()
                .extracting(e -> e.quote()).isEqualTo("반도체를 만든다.");
    }

    @Test
    @DisplayName("보내지 않은 근거가 하나라도 있거나 알 수 없는 상태면 문장 없이 검토 필요다")
    void unverifiedBriefingNeedsReview() {
        BriefingRecord badEvidence = interpret(response("GENERATED",
                new BriefingAiResponse.Sentence("가.", List.of("R#B1")),
                new BriefingAiResponse.Sentence("나.", List.of("R#B9"))));
        BriefingRecord unknown = interpret(response("MAYBE"));

        assertThat(badEvidence.status()).isEqualTo(BriefingStatus.REVIEW_NEEDED);
        assertThat(badEvidence.sentences()).isEmpty();
        assertThat(badEvidence.reviewReason()).isEqualTo(BriefingResults.BAD_EVIDENCE);
        assertThat(unknown.status()).isEqualTo(BriefingStatus.REVIEW_NEEDED);
        assertThat(unknown.reviewReason()).isEqualTo(BriefingResults.NOT_VERIFIED);
    }

    private static BriefingRecord interpret(BriefingAiResponse response) {
        return BriefingResults.interpret("R", "briefing-1", response, SOURCES, "trace", null);
    }

    private static BriefingAiResponse response(String status, BriefingAiResponse.Sentence... sentences) {
        return new BriefingAiResponse("briefing-1", null, "m", "2026-10-01T10:00:00", status, List.of(sentences),
                null, List.of(), null);
    }
}
