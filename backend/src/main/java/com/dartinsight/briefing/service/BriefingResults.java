package com.dartinsight.briefing.service;

import com.dartinsight.aiserver.client.AiServerException;
import com.dartinsight.briefing.domain.BriefingRecord;
import com.dartinsight.briefing.domain.BriefingSentence;
import com.dartinsight.briefing.domain.BriefingSource;
import com.dartinsight.briefing.domain.BriefingStatus;
import com.dartinsight.briefing.dto.BriefingAiRequest;
import com.dartinsight.briefing.dto.BriefingAiResponse;
import com.dartinsight.summary.domain.LlmCallRow;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * AI 서버 브리핑 요청 만들기와 응답 판정(BriefingService). 문장의 근거가 보낸 블록인지 여기서 다시 확인한다.
 */
final class BriefingResults {

    static final String TASK = "briefing";
    static final int QUOTE_CHARS = 600;
    static final String BAD_EVIDENCE = "브리핑 문장의 근거가 보낸 원문 위치가 아니라 쓰지 않았어요.";
    static final String NOT_VERIFIED = "근거를 확인하지 못해 브리핑을 보여 주지 않아요.";

    private static final Logger log = LoggerFactory.getLogger(BriefingResults.class);

    private BriefingResults() {
    }

    static BriefingAiRequest request(String promptVersion, String companyName, String reportName,
            List<BriefingSource> sources) {
        return new BriefingAiRequest(promptVersion, companyName, reportName, sources.stream()
                .map(s -> new BriefingAiRequest.Source(s.evidenceId(), s.topic().name(), s.sectionPath(), s.text()))
                .toList());
    }

    /** 상태가 없는 브리핑 응답은 AI 서버를 쓸 수 없는 것으로 본다 */
    static BriefingAiResponse requireStatus(BriefingAiResponse response) {
        if (response == null || response.status() == null) {
            throw new AiServerException(null, "AI 서버 브리핑 응답이 비어 있어요.", null);
        }
        return response;
    }

    static List<LlmCallRow> calls(BriefingAiResponse response, String traceId) {
        return response.calls() == null ? List.of() : response.calls().stream().map(c -> call(c, traceId)).toList();
    }

    /**
     * AI 서버 결과를 저장할 기록으로 바꾼다. 문장 하나라도 근거를 확인하지 못하면 문장 없이 검토 필요다.
     * GENERATED·REVIEW_NEEDED가 아닌 상태도 검토 필요다.
     */
    static BriefingRecord interpret(String rceptNo, String promptVersion, BriefingAiResponse response,
            List<BriefingSource> sources, String traceId, LocalDateTime createdAt) {
        LocalDateTime generatedAt = time(response.generatedAt());
        List<String> blocked = response.blockedRules() == null ? List.of() : response.blockedRules();
        Map<String, BriefingSource> byEvidence = sources.stream()
                .collect(Collectors.toMap(BriefingSource::evidenceId, Function.identity(), (a, b) -> a));
        BriefingStatus status = BriefingStatus.GENERATED.name().equals(response.status()) ? BriefingStatus.GENERATED
                : BriefingStatus.REVIEW_NEEDED;
        String reason = response.reviewReason();
        List<BriefingSentence> sentences = List.of();
        if (status == BriefingStatus.GENERATED) {
            sentences = verifiedSentences(response.sentences(), byEvidence);
            if (sentences.isEmpty()) {
                log.warn("AI 서버 브리핑의 근거를 확인하지 못해 검토 필요로 둡니다");
                status = BriefingStatus.REVIEW_NEEDED;
                reason = BAD_EVIDENCE;
            }
        } else if (!BriefingStatus.REVIEW_NEEDED.name().equals(response.status())) {
            log.warn("AI 서버 브리핑 상태를 알 수 없어 검토 필요로 둡니다: {}", response.status());
            reason = NOT_VERIFIED;
        }
        return new BriefingRecord(null, rceptNo, promptVersion, status, sentences,
                status == BriefingStatus.GENERATED ? null : reason == null ? NOT_VERIFIED : reason, blocked,
                response.model(), generatedAt, traceId, createdAt);
    }

    /** 모든 문장의 근거를 확인했으면 그 문장들, 하나라도 확인하지 못하면 빈 목록 */
    private static List<BriefingSentence> verifiedSentences(List<BriefingAiResponse.Sentence> items,
            Map<String, BriefingSource> byEvidence) {
        List<BriefingSentence> sentences = new ArrayList<>();
        for (BriefingAiResponse.Sentence item : items == null ? List.<BriefingAiResponse.Sentence>of() : items) {
            Optional<BriefingSentence> sentence = sentence(item, byEvidence);
            if (sentence.isEmpty()) {
                return new ArrayList<>();
            }
            sentences.add(sentence.get());
        }
        return sentences;
    }

    private static Optional<BriefingSentence> sentence(BriefingAiResponse.Sentence item,
            Map<String, BriefingSource> byEvidence) {
        if (item == null || item.text() == null || item.text().isBlank() || item.evidenceIds() == null
                || item.evidenceIds().isEmpty()) {
            return Optional.empty();
        }
        List<BriefingSentence.Evidence> evidence = new ArrayList<>();
        for (String evidenceId : item.evidenceIds().stream().distinct().toList()) {
            BriefingSource source = byEvidence.get(evidenceId);
            if (source == null) {
                return Optional.empty();
            }
            String text = source.text();
            evidence.add(new BriefingSentence.Evidence(evidenceId, source.sectionNo(), source.blockNo(),
                    source.sectionPath(), text.length() <= QUOTE_CHARS ? text : text.substring(0, QUOTE_CHARS)));
        }
        return Optional.of(new BriefingSentence(item.text().strip(), evidence));
    }

    private static LlmCallRow call(BriefingAiResponse.Call call, String traceId) {
        return new LlmCallRow(call.task() == null ? TASK : call.task(), call.provider(), call.model(),
                call.promptVersion(), time(call.calledAt()), call.traceId() == null ? traceId : call.traceId(),
                call.inputTokens(), call.outputTokens(), call.latencyMs() == null ? 0 : call.latencyMs(),
                call.attempt() == null ? 1 : call.attempt(), call.outcome(), call.error());
    }

    private static LocalDateTime time(String value) {
        try {
            return value == null ? null : LocalDateTime.parse(value);
        } catch (DateTimeParseException e) {
            return null;
        }
    }
}
